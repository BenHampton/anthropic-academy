/**
 * Predicts how well a photo will actually track, before you spend a minute
 * compiling it.
 *
 *   npm run targets:check public/targets/coca-cola-01.jpg
 *   npm run targets:check                       # every registered target
 *
 * This does NOT just count feature points, because the count does not predict
 * matching: a flat colour field scores 0 (correctly hopeless) but an image of
 * random rectangles scores ~3700, which tells you nothing about whether its
 * corners are distinctive enough to match.
 *
 * Instead it runs MindAR's own matcher. It builds the target's keyframes exactly
 * as the compiler does, then asks the matcher to find the target inside a
 * squeezed copy of itself. Squeezing horizontally by cos(angle) approximates
 * what happens to a label as a can rotates away from the camera, so the angle at
 * which matching fails estimates that photo's rotation coverage — which is what
 * decides how many angles you need per can.
 *
 * WHAT THIS CANNOT TELL YOU. Matching an image against a clean synthetic warp of
 * itself is the easiest possible test, so the result is an UPPER BOUND. A real
 * camera adds blur, noise, video compression, glare and uneven light, and a real
 * can adds genuine cylindrical distortion that a horizontal squeeze only
 * approximates. Passing here means "not degenerate", not "will track well".
 * Only the phone can tell you that. A failure here, though, is conclusive — an
 * image that cannot match a clean copy of itself has no chance against a camera.
 */
import { access } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage, type Image } from 'canvas'
import { buildImageList } from 'mind-ar/src/image-target/image-list.js'
import { Detector } from 'mind-ar/src/image-target/detector/detector.js'
import { Matcher } from 'mind-ar/src/image-target/matching/matcher.js'
import { build as hierarchicalClusteringBuild } from 'mind-ar/src/image-target/matching/hierarchical-clustering.js'
import * as tf from '@tensorflow/tfjs'
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js'
import { targetEntries, targetImagePath } from '../src/data/cans.ts'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** simulated viewing angles, degrees off straight-on */
const testAngles = [0, 20, 35, 50]
/** a match needs at least this many correspondences to be worth anything */
const minMatches = 8
/** frame the query into a camera-sized image, as the phone would see it */
const queryWidth = 1280
const queryHeight = 720

type GreyImage = { data: Uint8Array; width: number; height: number }

const exists = async (path: string) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const greyscale = (canvas: ReturnType<typeof createCanvas>): GreyImage => {
  const ctx = canvas.getContext('2d')
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const grey = new Uint8Array(canvas.width * canvas.height)
  for (let i = 0; i < grey.length; i++) {
    const offset = i * 4
    grey[i] = Math.floor((data[offset]! + data[offset + 1]! + data[offset + 2]!) / 3)
  }
  return { data: grey, width: canvas.width, height: canvas.height }
}

const detect = (image: GreyImage) => {
  const detector = new Detector(image.width, image.height)
  return tf.tidy(() => {
    const input = tf
      .tensor(image.data, [image.data.length], 'float32')
      .reshape([image.height, image.width])
    return detector.detect(input).featurePoints
  })
}

/** mirrors CompilerBase's matching-feature extraction, minus the slow tracking pass */
const buildKeyframes = (target: GreyImage) =>
  buildImageList(target).map((image) => {
    const points = detect(image)
    const maximaPoints = points.filter((p) => p.maxima)
    const minimaPoints = points.filter((p) => !p.maxima)
    return {
      maximaPoints,
      minimaPoints,
      maximaPointsCluster: hierarchicalClusteringBuild({ points: maximaPoints }),
      minimaPointsCluster: hierarchicalClusteringBuild({ points: minimaPoints }),
      width: image.width,
      height: image.height,
      scale: image.scale
    }
  })

/** the target as a camera would see it with the can turned `angle` degrees away */
const renderQuery = (image: Image, angle: number) => {
  const canvas = createCanvas(queryWidth, queryHeight)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, queryWidth, queryHeight)

  const drawHeight = queryHeight * 0.8
  const drawWidth = ((drawHeight * image.width) / image.height) * Math.cos((angle * Math.PI) / 180)
  ctx.drawImage(
    image,
    (queryWidth - drawWidth) / 2,
    (queryHeight - drawHeight) / 2,
    drawWidth,
    drawHeight
  )
  return greyscale(canvas)
}

const checkFile = async (file: string) => {
  const image = await loadImage(file)
  const source = createCanvas(image.width, image.height)
  source.getContext('2d').drawImage(image, 0, 0, image.width, image.height)

  const keyframes = buildKeyframes(greyscale(source))
  const matcher = new Matcher(queryWidth, queryHeight)

  const results = testAngles.map((angle) => {
    const query = renderQuery(image, angle)
    const { keyframeIndex, screenCoords } = matcher.matchDetection(keyframes, detect(query))
    return { angle, matched: keyframeIndex !== -1, matches: screenCoords?.length ?? 0 }
  })

  return { image, results }
}

const main = async () => {
  const requested = process.argv.slice(2)
  const files =
    requested.length > 0
      ? requested.map((file) => resolve(process.cwd(), file))
      : targetEntries.map((entry) => resolve(projectRoot, targetImagePath(entry.image)))

  if (files.length === 0) {
    console.error('\n✗ nothing to check — no targets registered and no file given\n')
    process.exit(1)
  }

  let anyUnusable = false

  for (const file of files) {
    const shortName = relative(projectRoot, file)
    console.log(`\n${shortName}`)

    if (!(await exists(file))) {
      console.log('  ✗ not found')
      anyUnusable = true
      continue
    }

    const { image, results } = await checkFile(file)
    console.log(`  ${image.width}x${image.height}`)

    results.forEach(({ angle, matched, matches }) => {
      const ok = matched && matches >= minMatches
      console.log(
        `  ${String(angle).padStart(2)}° off-axis  ${ok ? '✓' : '✗'}  ${matches} matches`
      )
    })

    const straightOn = results[0]
    const usable = straightOn ? straightOn.matched && straightOn.matches >= minMatches : false
    const widest = results.filter((r) => r.matched && r.matches >= minMatches).at(-1)

    if (!usable) {
      anyUnusable = true
      console.log(
        '  [UNUSABLE] cannot match even a clean copy of itself, so it has no chance\n' +
          '             against a real camera. Photograph printed detail — wordmarks,\n' +
          '             small print, logos. Large flat areas of one colour yield\n' +
          '             nothing to match on.'
      )
    } else if (!widest || widest.angle < 20) {
      console.log('  [NARROW] ideal-case coverage is near straight-on only — budget 6+ angles')
    } else if (widest.angle < 35) {
      console.log(`  [OK] ideal-case coverage to about ${widest.angle}° — budget 5 to 6 angles`)
    } else {
      console.log(`  [PASSES] ideal-case coverage to about ${widest.angle}° — start with 4 angles`)
    }
    if (usable) {
      console.log('             (upper bound: a clean self-match, not a real camera — verify on device)')
    }

    if (image.width < 600) {
      console.log('  note: under 600px wide — more resolution usually means more features')
    }
  }

  console.log('')
  process.exit(anyUnusable ? 1 : 0)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
