/**
 * Dev-only target capture page. Open it on the PHONE that will run the AR:
 *
 *   npm run dev  ->  https://<lan-ip>:5180/dev/capture.html
 *
 * Shoot several angles around a real can; each shot is cropped to the on-screen
 * guide and POSTed to the dev endpoint in scripts/captureEndpoint.ts, which
 * writes it into public/targets/. At the end it prints a paste-ready `Can`
 * entry for src/data/cans.ts.
 *
 * Why photograph the real can rather than use flat label artwork: MindAR is a
 * planar matcher, and at runtime it sees a curved, shaded label. Targets shot
 * from the same camera under the same curvature match far better.
 */
import { classifyCameraError, cameraProblemCopy } from '../src/ar/cameraErrors'
import './capture.css'

const root = document.getElementById('capture')
if (!root) throw new Error('missing #capture')

const totalAngles = 6
const jpegQuality = 0.92
/** long edge of the saved crop; bigger is not better, it just slows compiling */
const outputLongEdge = 1100

type Details = {
  id: string
  name: string
  flavour: string
  calories: number
  volumeMl: number
  bodyColor: string
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = []
) => {
  const node = Object.assign(document.createElement(tag), props)
  children.forEach((child) => node.append(child))
  return node
}

// ---------------------------------------------------------------- setup form

const renderSetup = () => {
  root.replaceChildren()
  const wrap = el('div', { className: 'setup' })

  const field = (
    label: string,
    name: keyof Details,
    value: string,
    hint?: string,
    attrs: Partial<HTMLInputElement> = {}
  ) => {
    const input = Object.assign(el('input', { name, value, required: true }), attrs)
    return el('label', { className: 'field' }, [
      el('span', { textContent: label }),
      input,
      ...(hint ? [el('div', { className: 'hint', textContent: hint })] : [])
    ])
  }

  const form = el('form', {}, [
    field('id', 'id', 'coca-cola', 'lowercase, digits and dashes — becomes the filenames', {
      pattern: '[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?'
    }),
    field('Name', 'name', 'Coca-Cola'),
    field('Flavour', 'flavour', 'Original cola'),
    field('Calories per can', 'calories', '139', undefined, { type: 'number', min: '0' }),
    field('Volume (ml)', 'volumeMl', '330', undefined, { type: 'number', min: '1' }),
    field('Body colour', 'bodyColor', '#c8102e', 'hex, used for the info card accent', {
      pattern: '#[0-9a-fA-F]{6}'
    }),
    el('button', { type: 'submit', textContent: 'Start capture' })
  ])

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(form)
    const read = (key: keyof Details) => String(data.get(key) ?? '').trim()
    void startShooting({
      id: read('id'),
      name: read('name'),
      flavour: read('flavour'),
      calories: Number(read('calories')),
      volumeMl: Number(read('volumeMl')),
      bodyColor: read('bodyColor')
    })
  })

  wrap.append(
    el('h1', { textContent: 'Capture can targets' }),
    el('p', {
      className: 'lede',
      textContent: `Photograph a real can from ${totalAngles} angles, rotating it about ${Math.round(
        360 / totalAngles
      )}° between shots. Fill the guide with the printed label — leave out the metal top and the background.`
    }),
    form
  )
  root.append(wrap)
}

// ----------------------------------------------------------------- shooting

const startShooting = async (details: Details) => {
  root.replaceChildren()
  const wrap = el('div', { className: 'shoot' })

  const video = el('video', { autoplay: true, muted: true, playsInline: true })
  // ios needs the attribute form too, or it takes the video fullscreen
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')

  const guide = el('div', { className: 'guide' })
  const step = el('p', { className: 'step' })
  const sub = el('p', { className: 'sub' })
  const dots = el('div', { className: 'dots' })
  const shutter = el('button', { type: 'button', textContent: 'Capture angle 1' })
  const hud = el('div', { className: 'hud' }, [step, sub, dots, shutter])

  wrap.append(video, guide, hud)
  root.append(wrap)

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    })
  } catch (cause) {
    const copy = cameraProblemCopy[classifyCameraError(cause)]
    hud.append(el('p', { className: 'error', textContent: `${copy.title} — ${copy.body}` }))
    return
  }

  video.srcObject = stream
  await video.play().catch(() => undefined)

  let captured = 0
  const files: string[] = []

  const paint = () => {
    step.textContent = `Angle ${captured + 1} of ${totalAngles}`
    sub.textContent =
      captured === 0
        ? 'Fill the guide with the label'
        : `Rotate the can about ${Math.round(360 / totalAngles)}°, then capture`
    shutter.textContent = `Capture angle ${captured + 1}`
    dots.replaceChildren(
      ...Array.from({ length: totalAngles }, (_, i) =>
        el('div', { className: `dot ${i < captured ? 'done' : ''}` })
      )
    )
  }
  paint()

  /**
   * Crops the frame to exactly what the guide rectangle covers. The video is
   * `object-fit: cover`, so the displayed image is a centre crop of the sensor
   * frame — that scaling has to be undone before mapping the guide rect back
   * into source pixels, or every target is subtly mis-framed.
   */
  const cropToGuide = () => {
    const sourceWidth = video.videoWidth
    const sourceHeight = video.videoHeight
    const viewWidth = video.clientWidth
    const viewHeight = video.clientHeight

    const coverScale = Math.max(viewWidth / sourceWidth, viewHeight / sourceHeight)
    const guideRect = guide.getBoundingClientRect()
    const videoRect = video.getBoundingClientRect()

    // guide rect in source pixels
    const cropWidth = guideRect.width / coverScale
    const cropHeight = guideRect.height / coverScale
    const cropX = (guideRect.left - videoRect.left) / coverScale - (viewWidth / coverScale - sourceWidth) / 2
    const cropY = (guideRect.top - videoRect.top) / coverScale - (viewHeight / coverScale - sourceHeight) / 2

    const scale = Math.min(1, outputLongEdge / Math.max(cropWidth, cropHeight))
    const canvas = el('canvas', {
      width: Math.round(cropWidth * scale),
      height: Math.round(cropHeight * scale)
    })
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(
      video,
      Math.max(0, cropX),
      Math.max(0, cropY),
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    )
    return canvas
  }

  const toBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolvePromise, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolvePromise(blob) : reject(new Error('encode failed'))),
        'image/jpeg',
        jpegQuality
      )
    )

  shutter.addEventListener('click', () => {
    void (async () => {
      shutter.disabled = true
      wrap.querySelector('.error')?.remove()
      try {
        const blob = await toBlob(cropToGuide())
        const angle = captured + 1
        const response = await fetch(
          `/__capture?id=${encodeURIComponent(details.id)}&angle=${angle}`,
          { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: blob }
        )
        const result = (await response.json()) as { file?: string; error?: string }
        if (!response.ok || !result.file) throw new Error(result.error ?? 'capture failed')

        files.push(result.file)
        captured = angle
        if (captured >= totalAngles) {
          stream.getTracks().forEach((track) => track.stop())
          renderResult(details, files)
          return
        }
        paint()
      } catch (error) {
        hud.append(
          el('p', {
            className: 'error',
            textContent: error instanceof Error ? error.message : 'capture failed'
          })
        )
      } finally {
        shutter.disabled = false
      }
    })()
  })
}

// ------------------------------------------------------------------- result

const renderResult = (details: Details, files: string[]) => {
  root.replaceChildren()

  const snippet = `  {
    id: '${details.id}',
    targetImages: [
${files.map((file) => `      '${file}'`).join(',\n')}
    ],
    name: '${details.name.replace(/'/g, "\\'")}',
    flavour: '${details.flavour.replace(/'/g, "\\'")}',
    calories: ${details.calories},
    volumeMl: ${details.volumeMl},
    bodyColor: '${details.bodyColor}',
    scale: 1
  }`

  const pre = el('pre', { textContent: snippet })
  const copy = el('button', { type: 'button', textContent: 'Copy entry' })
  copy.addEventListener('click', () => {
    void navigator.clipboard
      .writeText(snippet)
      .then(() => (copy.textContent = 'Copied'))
      .catch(() => (copy.textContent = 'Copy failed — select the text above'))
  })

  const again = el('button', {
    type: 'button',
    className: 'secondary',
    textContent: 'Capture another can'
  })
  again.addEventListener('click', renderSetup)

  root.append(
    el('div', { className: 'result' }, [
      el('h1', { textContent: `${files.length} angles saved` }),
      el('p', { className: 'lede', textContent: 'Add this to `cans` in src/data/cans.ts:' }),
      pre,
      copy,
      el('ol', {}, [
        el('li', { innerHTML: 'Paste the entry at the <strong>end</strong> of the array.' }),
        el('li', { innerHTML: 'Run <code>npm run compile:targets</code>.' }),
        el('li', { textContent: 'Reload the app and point the camera at the can.' })
      ]),
      again
    ])
  )
}

renderSetup()
