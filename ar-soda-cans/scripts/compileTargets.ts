/**
 * Compiles every target photo referenced by `src/data/cans.ts` into the binary
 * feature-point file MindAR loads at runtime.
 *
 *   npm run compile:targets   ->   public/targets.mind
 *
 * The compile order matches the `cans` array order, which is what makes
 * `targetIndex -> can` lookups valid at runtime. Rerun this whenever you add,
 * remove, reorder, or re-photograph a can.
 */
import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadImage } from 'canvas'
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js'
import { targetEntries, targetImagePath } from '../src/data/cans.ts'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(projectRoot, 'public/targets.mind')

const fileExists = async (path: string) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const fail = (message: string): never => {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

const main = async () => {
  if (targetEntries.length === 0) fail('no cans registered in src/data/cans.ts')

  const paths = targetEntries.map((entry) => ({
    entry,
    path: resolve(projectRoot, targetImagePath(entry.image))
  }))
  const missing = (
    await Promise.all(paths.map(async (p) => ((await fileExists(p.path)) ? null : p)))
  ).filter((p) => p !== null)

  if (missing.length > 0) {
    const list = missing.map(
      (m) =>
        `  - ${targetImagePath(m.entry.image)}  ("${m.entry.can.name}", angle ${m.entry.angle})`
    )
    fail(
      `missing ${missing.length} target photo(s):\n${list.join('\n')}\n\n` +
        '  Add the photo(s), or remove them from targetImages in src/data/cans.ts.\n' +
        '  See README.md for how to shoot a good tracking target.'
    )
  }

  const canCount = new Set(targetEntries.map((entry) => entry.can.id)).size
  console.log(`compiling ${targetEntries.length} target(s) across ${canCount} can(s)...`)
  const images = await Promise.all(paths.map((p) => loadImage(p.path)))

  images.forEach((image, i) => {
    const { can, angle } = targetEntries[i]!
    const label = `${can.name} #${angle}`
    console.log(`  [${i}] ${label.padEnd(22)} ${image.width}x${image.height}`)
    if (image.width < 300) {
      console.warn(`      warning: only ${image.width}px wide — tracking will be poor`)
    }
  })

  const compiler = new OfflineCompiler()
  let lastLogged = -10
  await compiler.compileImageTargets(images, (percent: number) => {
    if (percent - lastLogged >= 10) {
      lastLogged = percent
      console.log(`  ${Math.round(percent)}%`)
    }
  })

  const buffer = compiler.exportData()
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, buffer)

  const kb = (buffer.byteLength / 1024).toFixed(1)
  console.log(`\n✓ wrote public/targets.mind (${kb} kB, ${targetEntries.length} target(s))\n`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
