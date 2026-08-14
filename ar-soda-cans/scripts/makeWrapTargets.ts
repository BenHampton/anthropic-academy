/**
 * Generates tracking targets from a flat 360° label unwrap, without photographing
 * anything.
 *
 *   npm run targets:from-wrap public/targets/coca-cola/wrapper.jpg coca-cola
 *   npm run targets:from-wrap <wrapper> <id> --slices 12
 *
 * Slices are written to public/targets/<id>/wrap-NN.jpg. Put the wrapper at
 * public/targets/<id>/wrapper.jpg so labelTexture resolves to <id>/wrapper.jpg.
 *
 * WHY SLICES. MindAR matches with a planar homography, and a flat full wrap has
 * no planar correspondence to a curved can — measured, it scores 0-10 matches,
 * i.e. noise. What does work is pre-warping the artwork the way a cylinder
 * distorts it: a surface point at angle theta appears at x = R*sin(theta). Each
 * slice is that projection centred on one rotation of the can.
 *
 * MEASURED COVERAGE. A slice matches its own rotation strongly (~35 matches),
 * holds to about 15-20°, and is gone by 30°. Hence the 30° default spacing.
 * Shading is baked in because it measurably helps (15 vs 10 matches at 15°).
 *
 * THE HONEST CAVEAT. All of that was measured against a SYNTHETIC can rendered
 * from this same artwork, with a smooth cosine shading model. A real can adds
 * specular highlights, environment reflections, dents and condensation that the
 * model does not reproduce, so real-world coverage will be worse — possibly much
 * worse. This route is worth trying because it costs no photography, not because
 * it is known to work. Photographs from the phone that will run the AR remain
 * the reliable option: `npm run dev` then /dev/capture.html.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = resolve(projectRoot, 'public/targets')

/** a 330ml can: 66mm across, 115mm tall */
const canDiameterMm = 66
const canHeightMm = 115
const defaultSlices = 12
const sliceHeightPx = 900

// annotated on the variable, not just the arrow: TS only treats a const arrow
// function as never-returning for narrowing when the variable itself is typed
const fail: (message: string) => never = (message) => {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

/**
 * Renders the label as it appears wrapped on a cylinder seen head-on, centred on
 * `centreDeg` of the wrap. Column x maps to surface angle theta = asin(x/R), and
 * the wrap coordinate is linear in theta.
 */
const renderSlice = (
  wrapper: Awaited<ReturnType<typeof loadImage>>,
  centreDeg: number,
  height: number
) => {
  const width = Math.round((height * canDiameterMm) / canHeightMm)
  const radius = width / 2

  const source = createCanvas(wrapper.width, wrapper.height)
  source.getContext('2d').drawImage(wrapper, 0, 0)
  const src = source.getContext('2d').getImageData(0, 0, wrapper.width, wrapper.height)

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const out = ctx.createImageData(width, height)

  for (let x = 0; x < width; x++) {
    const ratio = Math.max(-1, Math.min(1, (x - radius) / radius))
    const theta = Math.asin(ratio)
    const u = (((centreDeg / 360 + theta / (2 * Math.PI)) % 1) + 1) % 1
    const sx = Math.min(wrapper.width - 1, Math.floor(u * wrapper.width))
    // lambert-ish falloff: a real can is brightest where it faces the camera
    const light = 0.45 + 0.55 * Math.cos(theta)

    for (let y = 0; y < height; y++) {
      const sy = Math.min(wrapper.height - 1, Math.floor((y / height) * wrapper.height))
      const so = (sy * wrapper.width + sx) * 4
      const dest = (y * width + x) * 4
      out.data[dest] = src.data[so]! * light
      out.data[dest + 1] = src.data[so + 1]! * light
      out.data[dest + 2] = src.data[so + 2]! * light
      out.data[dest + 3] = 255
    }
  }

  ctx.putImageData(out, 0, 0)
  return canvas
}

const main = async () => {
  const args = process.argv.slice(2)
  const flagIndex = args.indexOf('--slices')
  const slices = flagIndex === -1 ? defaultSlices : Number(args[flagIndex + 1])
  // guard on flagIndex: when the flag is absent it is -1, and -1 + 1 === 0
  // would silently eat the first positional argument
  const positional =
    flagIndex === -1 ? args : args.filter((_, i) => i !== flagIndex && i !== flagIndex + 1)
  const [wrapperArg, idArg] = positional

  if (!wrapperArg || !idArg) {
    fail('usage: npm run targets:from-wrap <wrapper.jpg> <id> [--slices 12]')
  }
  if (!Number.isInteger(slices) || slices < 2 || slices > 36) {
    fail('--slices must be an integer between 2 and 36')
  }
  if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(idArg)) {
    fail('id must be lowercase letters, digits and dashes')
  }

  const wrapperPath = resolve(process.cwd(), wrapperArg)
  const wrapper = await loadImage(wrapperPath).catch(() => fail(`cannot read ${wrapperArg}`))

  const aspect = wrapper.width / wrapper.height
  const expected = (Math.PI * canDiameterMm) / canHeightMm
  console.log(`\nwrapper ${basename(wrapperPath)}  ${wrapper.width}x${wrapper.height}`)
  console.log(`  aspect ${aspect.toFixed(2)} (a full 330ml wrap is about ${expected.toFixed(2)})`)
  if (Math.abs(aspect - expected) > 0.45) {
    console.log('  warning: that does not look like a full 360° wrap — slices may be wrong')
  }
  if (wrapper.width < 1200) {
    console.log(
      `  warning: only ${wrapper.width}px wide for the whole circumference, so each\n` +
        '           slice is upsampled and soft. Higher-resolution artwork tracks better.'
    )
  }

  const canDir = resolve(outputDir, idArg)
  await mkdir(canDir, { recursive: true })
  const files: string[] = []

  for (let i = 0; i < slices; i++) {
    const centre = (360 / slices) * i
    // slices live under the can's own folder: public/targets/<id>/wrap-NN.jpg
    const file = `${idArg}/wrap-${String(i + 1).padStart(2, '0')}.jpg`
    const canvas = renderSlice(wrapper, centre, sliceHeightPx)
    await writeFile(resolve(outputDir, file), canvas.toBuffer('image/jpeg', { quality: 0.92 }))
    files.push(file)
    console.log(`  wrote ${file}  (centred ${centre.toFixed(0)}°)`)
  }

  // MindAR normalises the TARGET WIDTH to 1 unit. A slice is exactly one can
  // diameter wide, so the can's height in those units is height/diameter.
  const scale = (canHeightMm / canDiameterMm).toFixed(2)

  console.log(`\nAdd to \`cans\` in src/data/cans.ts:\n`)
  console.log(`  {
    id: '${idArg}',
    targetImages: [
${files.map((file) => `      '${file}'`).join(',\n')}
    ],
    name: 'Coca-Cola',
    flavour: 'Original cola',
    calories: 139,
    volumeMl: 330,
    labelTexture: '${idArg}/${basename(wrapperPath)}',
    bodyColor: '#c8102e',
    scale: ${scale}
  }`)
  console.log(`\nthen: npm run compile:targets   (${slices} more targets, budget a while)\n`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
