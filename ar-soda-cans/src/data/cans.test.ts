import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cans, canByTargetIndex, labelTextureUrl, targetEntries, targetImagePath } from './cans'

const projectRoot = resolve(import.meta.dirname, '../..')

const exists = async (path: string) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('cans registry', () => {
  it('has at least one can', () => {
    expect(cans.length).toBeGreaterThan(0)
  })

  it('has unique ids', () => {
    const ids = cans.map((can) => can.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique target images across all cans', () => {
    // a photo shared between two cans would make one of them unreachable
    const images = targetEntries.map((entry) => entry.image)
    expect(new Set(images).size).toBe(images.length)
  })

  it('gives every can at least one angle', () => {
    cans.forEach((can) => {
      expect(can.targetImages.length, `${can.id} has no target images`).toBeGreaterThan(0)
    })
  })

  it('has sane metadata on every can', () => {
    cans.forEach((can) => {
      expect(can.id, 'id must be a kebab-case slug').toMatch(/^[a-z0-9-]+$/)
      can.targetImages.forEach((image) => {
        expect(image, 'target must be a jpg or png').toMatch(/\.(jpe?g|png)$/i)
      })
      expect(can.name.length).toBeGreaterThan(0)
      expect(can.flavour.length).toBeGreaterThan(0)
      expect(can.calories).toBeGreaterThanOrEqual(0)
      expect(can.volumeMl).toBeGreaterThan(0)
      expect(can.bodyColor, 'body colour must be a hex triplet').toMatch(/^#[0-9a-f]{6}$/i)
      expect(can.scale).toBeGreaterThan(0)
    })
  })

  it('maps every target index back to the can that photo belongs to', () => {
    // this is THE invariant: reordering `cans`, or a can's targetImages,
    // without recompiling targets.mind silently pairs cans with the wrong model
    targetEntries.forEach((entry, index) => {
      expect(canByTargetIndex(index)).toBe(entry.can)
    })
    expect(canByTargetIndex(targetEntries.length)).toBeUndefined()
    expect(canByTargetIndex(-1)).toBeUndefined()
  })

  it('maps every angle of a multi-angle can back to that same can', () => {
    // the whole point of multi-angle: several target indices, one drink
    cans
      .filter((can) => can.targetImages.length > 1)
      .forEach((can) => {
        const indices = targetEntries
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.can === can)
          .map(({ index }) => index)

        expect(indices.length).toBe(can.targetImages.length)
        indices.forEach((index) => expect(canByTargetIndex(index)).toBe(can))
      })
  })

  it('numbers angles from 1 within each can', () => {
    cans.forEach((can) => {
      const angles = targetEntries.filter((entry) => entry.can === can).map((entry) => entry.angle)
      expect(angles).toEqual(can.targetImages.map((_, i) => i + 1))
    })
  })

  it('builds browser urls under /targets, defaulting to the first angle', () => {
    cans.forEach((can) => {
      expect(labelTextureUrl(can)).toBe(`/targets/${can.labelTexture ?? can.targetImages[0]}`)
    })
  })

})

/**
 * These assert the project is SET UP, not that the code is correct. On a fresh
 * clone they fail until you add your can photos and compile them — that is the
 * intended signal. See README.md.
 */
describe('project setup', () => {
  it('has a photo on disk for every registered angle', async () => {
    const missing: string[] = []
    for (const entry of targetEntries) {
      if (!(await exists(resolve(projectRoot, targetImagePath(entry.image))))) {
        missing.push(targetImagePath(entry.image))
      }
    }
    expect(
      missing,
      'add these photos (see README) or remove their entries from src/data/cans.ts'
    ).toEqual([])
  })

  it('has a compiled targets.mind', async () => {
    expect(
      await exists(resolve(projectRoot, 'public/targets.mind')),
      'run: npm run compile:targets'
    ).toBe(true)
  })
})
