import {
  DirectionalLight,
  HemisphereLight,
  PMREMGenerator,
  TextureLoader,
  type Texture
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  MindARThree,
  type MindArAnchor,
  type MindArThreeOptions
} from 'mind-ar/dist/mindar-image-three.prod.js'
import { buildCan, getSpinTarget, type CanModel } from './buildCan'
import { targetEntries, type Can } from '../data/cans'

/** how fast a found can rotates, radians per second */
const spinSpeed = 0.6

export type ArSceneCallbacks = {
  /** fires with the can whose label is currently tracked, or null when lost */
  onActiveCanChange: (can: Can | null) => void
}

export type ArScene = {
  /** tears down the render loop, the camera stream and every gpu resource */
  stop: () => void
}

type TrackedAnchor = {
  can: Can
  anchor: MindArAnchor
  model: CanModel
}

/**
 * MindAR creates its <video> with `setAttribute('muted', '')`. On an element
 * built by document.createElement that sets `defaultMuted` but NOT the `muted`
 * property, so browsers treat the stream as unmuted, refuse to autoplay it, and
 * the app shows a black screen with tracking that never fires.
 *
 * Watch the container and mute the element the instant MindAR appends it —
 * before the autoplay decision is made. Muted autoplay is always permitted, so
 * this needs no user gesture.
 */
const muteVideoOnInsert = (container: HTMLElement) => {
  const apply = (video: HTMLVideoElement) => {
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    // ios safari also needs this to avoid taking over the screen
    video.setAttribute('webkit-playsinline', '')
  }

  const existing = container.querySelector('video')
  if (existing) apply(existing)

  const observer = new MutationObserver(() => {
    const video = container.querySelector('video')
    if (video) apply(video)
  })
  observer.observe(container, { childList: true, subtree: true })
  return observer
}

/**
 * MindAR registers `window.addEventListener('resize', ...)` in its constructor
 * and never removes it. The handler dereferences `this.controller`, which only
 * exists between start() and stop(), so a resize before start or after stop
 * throws — and the listener outlives the scene, so every torn-down scene leaks
 * one permanently-throwing handler.
 *
 * Intercept addEventListener for the duration of the constructor call so we own
 * that listener and can attach and detach it on our own terms.
 */
const constructWithCapturedResize = (options: MindArThreeOptions) => {
  let capturedResize: EventListener | null = null
  const originalAddEventListener = window.addEventListener

  window.addEventListener = function (
    this: Window,
    type: string,
    listener: EventListenerOrEventListenerObject,
    listenerOptions?: boolean | AddEventListenerOptions
  ) {
    if (type === 'resize' && capturedResize === null) {
      capturedResize = listener as EventListener
      return
    }
    return originalAddEventListener.call(this, type, listener, listenerOptions)
  } as typeof window.addEventListener

  try {
    const instance = new MindARThree(options)
    return { instance, capturedResize }
  } finally {
    window.addEventListener = originalAddEventListener
  }
}

const stopVideoTracks = (video: HTMLVideoElement | undefined) => {
  const stream = video?.srcObject
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop())
  }
  if (video) video.srcObject = null
}

/**
 * Boots MindAR image tracking over the container and renders one procedural can
 * per registered target.
 *
 * This owns raw WebGL and a camera stream, so the returned `stop()` is not
 * optional — call it on unmount or the camera stays live.
 */
export const startArScene = async (
  container: HTMLElement,
  callbacks: ArSceneCallbacks
): Promise<ArScene> => {
  // how many cans to track/overlay at once — configurable via .env (VITE_MAX_TRACK),
  // defaults to 1. Read at build / dev-server start, so a vite restart is needed to
  // pick up a change; it does NOT require recompiling targets.mind.
  const maxTrack = Math.max(1, Math.floor(Number(import.meta.env.VITE_MAX_TRACK) || 1))
  // where MindAR loads the compiled tracking data from (VITE_TARGETS_SRC), so you can
  // point at a CDN or an alternate target bundle without a code change. Defaults to
  // the bundled /targets.mind.
  const targetsSrc = import.meta.env.VITE_TARGETS_SRC || '/targets.mind'

  const { instance: mindarThree, capturedResize } = constructWithCapturedResize({
    container,
    imageTargetSrc: targetsSrc,
    // when >1, several cans overlay at once; the info card shows the latest found
    maxTrack,
    // we render our own loading/scanning/error ui in react
    uiLoading: false,
    uiScanning: false,
    uiError: false,
    // a little smoothing; raises latency slightly but stops the can jittering
    filterMinCF: 0.001,
    filterBeta: 0.01
  })

  const { renderer, scene, camera } = mindarThree
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const pmrem = new PMREMGenerator(renderer)
  const environment: Texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment

  const hemisphere = new HemisphereLight(0xffffff, 0x404050, 1.1)
  const key = new DirectionalLight(0xffffff, 1.6)
  key.position.set(0.5, 1, 1)
  scene.add(hemisphere, key)

  // one loader for every can so identical label urls share a cache entry
  const textureLoader = new TextureLoader()

  // One anchor per PHOTO, not per can — several angles of the same can each get
  // their own anchor and their own model. With maxTrack:1 only one is ever
  // visible, so the duplicate models cost memory, not correctness.
  const tracked: TrackedAnchor[] = targetEntries.map(({ can }, index) => {
    const anchor = mindarThree.addAnchor(index)
    const model = buildCan(can, { textureLoader })
    anchor.group.add(model.object)
    return { can, anchor, model }
  })

  // MindAR fires found/lost per anchor; keep a stack so a fast switch between
  // two cans never leaves the ui showing a can that is no longer visible
  const foundStack: Can[] = []
  const publishActive = () => callbacks.onActiveCanChange(foundStack.at(-1) ?? null)

  tracked.forEach(({ can, anchor }) => {
    anchor.onTargetFound = () => {
      foundStack.push(can)
      publishActive()
    }
    anchor.onTargetLost = () => {
      const index = foundStack.lastIndexOf(can)
      if (index !== -1) foundStack.splice(index, 1)
      publishActive()
    }
  })

  const videoObserver = muteVideoOnInsert(container)

  try {
    await mindarThree.start()
  } finally {
    videoObserver.disconnect()
  }

  // belt and braces: if autoplay was still refused, the element is genuinely
  // muted by now, so an explicit play() is allowed without a user gesture
  const { video } = mindarThree
  if (video?.paused) {
    video.muted = true
    await video.play()
  }

  // safe to attach only now that the controller exists; also covers ios where
  // the safari toolbar collapsing fires a resize mid-session
  if (capturedResize) window.addEventListener('resize', capturedResize)
  if (capturedResize) window.addEventListener('orientationchange', capturedResize)

  // three.Clock is deprecated in r185, and a manual delta avoids pulling in the
  // Timer addon for one subtraction
  let lastFrameTime = performance.now()
  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const delta = (now - lastFrameTime) / 1000
    lastFrameTime = now
    tracked.forEach(({ anchor, model }) => {
      if (!anchor.group.visible) return
      getSpinTarget(model).rotation.y += spinSpeed * delta
    })
    renderer.render(scene, camera)
  })

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true

    renderer.setAnimationLoop(null)
    videoObserver.disconnect()
    if (capturedResize) {
      window.removeEventListener('resize', capturedResize)
      window.removeEventListener('orientationchange', capturedResize)
    }
    tracked.forEach(({ anchor }) => {
      anchor.onTargetFound = undefined
      anchor.onTargetLost = undefined
    })

    try {
      mindarThree.stop()
    } catch {
      // stop() throws if start() never fully resolved; the track cleanup below
      // is what actually matters
    }
    stopVideoTracks(mindarThree.video)

    tracked.forEach(({ model }) => model.dispose())
    scene.remove(hemisphere, key)
    hemisphere.dispose()
    key.dispose()
    environment.dispose()
    pmrem.dispose()
    scene.environment = null
    renderer.dispose()
    renderer.forceContextLoss()

    // MindAR appends its canvas, css3d layer and video to the container, and
    // React does not own those nodes. Remove exactly the ones THIS scene added
    // — never clear the container, because a scene that is torn down late would
    // then delete a newer scene's video and leave a black screen behind.
    ;[renderer.domElement, mindarThree.cssRenderer?.domElement, mindarThree.video].forEach(
      (node) => node?.remove()
    )

    foundStack.length = 0
    callbacks.onActiveCanChange(null)
  }

  return { stop }
}
