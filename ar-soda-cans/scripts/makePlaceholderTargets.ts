/**
 * Generates the placeholder tracking targets in `public/targets/`.
 *
 *   npm run targets:placeholders
 *
 * These are INVENTED labels, not photographs of real cans. They exist so the
 * app runs end to end on a fresh clone: display one on a screen (or print it)
 * and point the camera at it. Replace them with real can photos when you have
 * them — see README.md.
 *
 * They are deliberately dense with corner features (text at several sizes, a
 * barcode, small print), because that is what MindAR's detector keys off. A
 * flat two-colour label tracks badly no matter how good the photo is.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from 'canvas'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = resolve(projectRoot, 'public/targets')

const width = 900
const height = 1200

type Placeholder = {
  /** output path under public/targets, e.g. 'placeholder-cola/label.jpg' */
  file: string
  wordmark: string
  background: string
  accent: string
  /** fixed seed so regenerating produces byte-identical output */
  seed: number
}

const placeholders: Placeholder[] = [
  { file: 'placeholder-cola/label.jpg', wordmark: 'COLA', background: '#c8102e', accent: '#7a0a1c', seed: 101 },
  { file: 'placeholder-lemon/label.jpg', wordmark: 'LEMON', background: '#0f7b46', accent: '#063d22', seed: 202 },
  { file: 'placeholder-orange/label.jpg', wordmark: 'ORANGE', background: '#e8590c', accent: '#7a2f05', seed: 303 }
]

const smallPrint = [
  'NO ARTIFICIAL FLAVOURS',
  'SERVE CHILLED · 330ml e',
  'NUTRITION PER 100ml',
  'ENERGY 180kJ / 42kcal',
  'SUGARS 10.6g · SALT 0.00g',
  'BEST BEFORE SEE BASE'
]

const draw = ({ wordmark, background, accent, seed }: Placeholder) => {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // deterministic lcg so the images never change between runs
  let state = seed
  const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648

  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = accent
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 5; i++) {
    ctx.lineWidth = 8 + random() * 26
    ctx.beginPath()
    ctx.ellipse(
      width * (0.2 + random() * 0.6),
      height * (0.15 + random() * 0.7),
      120 + random() * 260,
      60 + random() * 160,
      random() * 3,
      0,
      Math.PI * 2
    )
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = 'bold 130px Helvetica'
  ctx.fillText(wordmark, width / 2, height * 0.34)
  ctx.font = 'italic 54px Helvetica'
  ctx.fillText('ORIGINAL TASTE', width / 2, height * 0.42)

  ctx.fillRect(width * 0.18, height * 0.46, width * 0.64, 6)
  ctx.font = '26px Helvetica'
  smallPrint.forEach((line, i) => ctx.fillText(line, width / 2, height * 0.52 + i * 44))

  let x = width * 0.24
  while (x < width * 0.76) {
    const barWidth = 3 + random() * 9
    ctx.fillStyle = random() > 0.45 ? '#ffffff' : background
    ctx.fillRect(x, height * 0.8, barWidth, 120)
    x += barWidth
  }

  ctx.fillStyle = accent
  for (let i = 0; i < 14; i++) {
    ctx.beginPath()
    ctx.arc(width * (0.08 + random() * 0.84), height * (0.05 + random() * 0.06), 6 + random() * 18, 0, Math.PI * 2)
    ctx.fill()
  }

  return canvas.toBuffer('image/jpeg', { quality: 0.92 })
}

const main = async () => {
  for (const placeholder of placeholders) {
    const outPath = resolve(outputDir, placeholder.file)
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, draw(placeholder))
    console.log(`  wrote public/targets/${placeholder.file}`)
  }
  console.log('\n✓ placeholders regenerated — now run: npm run compile:targets\n')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
