/**
 * Desktop smoke test for the AR pipeline — no phone and no real can needed.
 *
 * Replaces getUserMedia with a canvas stream that renders a target photo, so
 * MindAR gets a "camera" it can genuinely detect against. Verifies that
 * targets.mind parses, tfjs and webgl initialise, a target is found, and
 * teardown releases everything.
 *
 *   NO_HTTPS=1 npm run dev   ->   http://localhost:5173/dev/smoke.html
 */
import { startArScene } from '../src/ar/arScene'
import { cans } from '../src/data/cans'

const log = (...args: unknown[]) => console.log('[smoke]', ...args)

const width = 1280
const height = 720

const canvas = document.createElement('canvas')
canvas.width = width
canvas.height = height
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('no 2d context')

const images = await Promise.all(
  cans.map(async (can) => {
    const image = new Image()
    image.src = `/targets/${can.targetImage}`
    await image.decode()
    return image
  })
)
let image = images[0]
if (!image) throw new Error('no cans registered')
log('loaded', images.length, 'target images')

// captureStream(0) + requestFrame rather than an fps + rAF loop: rAF stops
// entirely when the tab is not being painted, which starves the fake camera
const stream = canvas.captureStream(0)
const [track] = stream.getVideoTracks() as [CanvasCaptureMediaStreamTrack]

const drawFrame = () => {
  ctx.fillStyle = '#777'
  ctx.fillRect(0, 0, width, height)
  if (image) {
    const drawHeight = height * 0.78
    const drawWidth = (drawHeight * image.width) / image.height
    ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  }
  track.requestFrame()
}
drawFrame()
setInterval(drawFrame, 33)
navigator.mediaDevices.getUserMedia = async () => stream
log('getUserMedia stubbed with a canvas stream')

declare global {
  // eslint-disable-next-line no-var
  var smoke: {
    active: string | null
    started: boolean
    error: string | null
    stop: () => void
    /** point the fake camera at a different registered can */
    show: (index: number) => string
    /** point it at nothing, to exercise target-lost */
    hide: () => void
    /**
     * Starts a SECOND scene into the same container, to reproduce the
     * StrictMode interleaving where one scene is torn down while another is
     * live. Stopping either must leave the other's video attached.
     */
    startAnother: () => Promise<{ stop: () => void }>
  }
}

globalThis.smoke = {
  active: null,
  started: false,
  error: null,
  stop: () => {},
  show: (index) => {
    image = images[index]
    return cans[index]?.id ?? 'out of range'
  },
  hide: () => {
    image = undefined
  },
  startAnother: () =>
    startArScene(document.getElementById('ar')!, { onActiveCanChange: () => {} })
}

try {
  const scene = await startArScene(document.getElementById('ar')!, {
    onActiveCanChange: (can) => {
      globalThis.smoke.active = can?.id ?? null
      log('active can:', can?.id ?? 'none')
    }
  })
  globalThis.smoke.started = true
  globalThis.smoke.stop = scene.stop
  log('scene started')
} catch (error) {
  globalThis.smoke.error = String(error)
  log('scene failed:', error)
}
