import { Mesh, Texture, TextureLoader, type BufferGeometry, type Material } from 'three'
import { describe, expect, it } from 'vitest'
import { buildCan, getSpinTarget } from './buildCan'
import type { Can } from '../data/cans'

// buildCan only ever calls loader.load, and a real TextureLoader needs a DOM
// image, so a stub keeps this a pure geometry test
const stubLoader = { load: () => new Texture() } as unknown as TextureLoader

const testCan: Can = {
  id: 'test-cola',
  targetImages: ['test-cola-01.jpg', 'test-cola-02.jpg'],
  name: 'Test Cola',
  flavour: 'Test',
  calories: 100,
  volumeMl: 330,
  bodyColor: '#ff0000',
  scale: 1.5
}

const build = () => buildCan(testCan, { textureLoader: stubLoader })

describe('buildCan', () => {
  it('names the object after the can', () => {
    const model = build()
    expect(model.object.name).toBe('can:test-cola')
    model.dispose()
  })

  it('leaves the can upright in the target plane', () => {
    // MindAR anchors lie in XY with +Y up in the image, and the lathe is built
    // around +Y, so any rotation here would tip the can over — pointing its
    // axis at the camera shows you the base instead of the label
    const model = build()
    expect(model.object.rotation.x).toBe(0)
    expect(model.object.rotation.y).toBe(0)
    expect(model.object.rotation.z).toBe(0)
    model.dispose()
  })

  it('centres the can on the target and sets its axis behind the label plane', () => {
    const model = build()
    const { position } = getSpinTarget(model)
    expect(position.x).toBe(0)
    // half a can down, so the target sits at mid-height rather than the base
    expect(position.y).toBeCloseTo(-0.5 * testCan.scale)
    // one radius back, so the label surface lands in the target plane
    expect(position.z).toBeLessThan(0)
    model.dispose()
  })

  it('scales the can to the requested height', () => {
    const model = build()
    expect(getSpinTarget(model).scale.x).toBeCloseTo(testCan.scale)
    model.dispose()
  })

  it('builds a body, base, lid and tab', () => {
    const model = build()
    const meshes: Mesh[] = []
    model.object.traverse((child) => {
      if (child instanceof Mesh) meshes.push(child)
    })
    expect(meshes).toHaveLength(4)
    meshes.forEach((mesh) => expect(mesh.geometry.getAttribute('uv')).toBeDefined())
    model.dispose()
  })

  it('releases every geometry, material and texture on dispose', () => {
    const model = build()

    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    const textures = new Set<Texture>()

    model.object.traverse((child) => {
      if (!(child instanceof Mesh)) return
      geometries.add(child.geometry)
      const material = child.material as Material
      materials.add(material)
      const map = (material as Material & { map?: Texture | null }).map
      if (map) textures.add(map)
    })

    const disposed = new Set<object>()
    const watch = (resource: { addEventListener: (t: 'dispose', l: () => void) => void }) =>
      resource.addEventListener('dispose', () => disposed.add(resource))

    geometries.forEach(watch)
    materials.forEach(watch)
    textures.forEach(watch)

    const total = geometries.size + materials.size + textures.size
    expect(total).toBeGreaterThan(0)

    model.dispose()

    expect(disposed.size, 'every gpu resource must be freed').toBe(total)
    expect(model.object.children).toHaveLength(0)
  })
})
