import {
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  MirroredRepeatWrapping,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector2,
  type Texture
} from 'three'
import { labelTextureUrl, type Can } from '../data/cans'

/**
 * A 330ml can is 115mm tall and 66mm wide. The lathe profile below is authored
 * in "can units" where height = 1, so radius = 66 / 115 / 2.
 */
const canHeight = 1
const radius = 66 / 115 / 2

/** where the wrapped label starts and ends up the body */
const labelBottom = 0.055
const labelTop = 0.955

type ProfilePoint = [x: number, y: number]

const basePoints: ProfilePoint[] = [
  [0, 0.038],
  [radius * 0.3, 0.036],
  [radius * 0.55, 0.026],
  [radius * 0.72, 0.002],
  [radius * 0.86, 0.0],
  [radius * 0.95, 0.014],
  [radius, labelBottom]
]

const bodyPoints: ProfilePoint[] = [
  [radius, labelBottom],
  [radius, 0.62],
  [radius, 0.79],
  [radius * 0.995, 0.825],
  [radius * 0.965, 0.862],
  [radius * 0.9, 0.898],
  [radius * 0.812, 0.928],
  [radius * 0.73, labelTop]
]

const lidPoints: ProfilePoint[] = [
  [radius * 0.73, labelTop],
  [radius * 0.705, 0.966],
  [radius * 0.718, 0.982],
  [radius * 0.695, 0.99],
  [radius * 0.66, 0.982],
  [radius * 0.64, 0.968],
  [radius * 0.42, 0.964],
  [0, 0.968]
]

const toVectors = (points: ProfilePoint[]) => points.map(([x, y]) => new Vector2(x, y))

/** bare aluminium — used for the base, the lid and the pull tab */
const createAluminium = () =>
  new MeshStandardMaterial({
    color: '#cdd3d8',
    metalness: 1,
    roughness: 0.24
  })

export type CanModel = {
  /** add this to a MindAR anchor group */
  object: Group
  /** frees every gpu resource this model owns */
  dispose: () => void
}

export type BuildCanOptions = {
  /** shared loader so repeated builds hit the browser cache */
  textureLoader?: TextureLoader
}

/**
 * Builds a soda can mesh sized so its HEIGHT is `can.scale` world units and
 * positions it where the real can is.
 *
 * MindAR anchor space puts the target image in the XY plane, centred on the
 * origin, width normalised to 1 unit, with +Y being "up" in the image and +Z
 * pointing out of it towards the camera. The lathe is already built around +Y,
 * so the can needs NO rotation — it only needs shifting, because the lathe
 * starts with its base at y=0 and its axis on the origin.
 */
export const buildCan = (can: Can, options: BuildCanOptions = {}): CanModel => {
  const loader = options.textureLoader ?? new TextureLoader()

  const label = loader.load(labelTextureUrl(can))
  label.colorSpace = SRGBColorSpace
  label.anisotropy = 8

  if (can.labelTexture) {
    // an explicit labelTexture is a proper flat 360° unwrap, so it maps
    // straight round the cylinder once
    label.wrapS = RepeatWrapping
    label.repeat.set(1, 1)
  } else {
    // falling back to a tracking photo: it shows roughly half the
    // circumference, so map it across 180° and mirror it round the back rather
    // than smearing half a can over the full 360°
    label.wrapS = MirroredRepeatWrapping
    label.repeat.set(2, 1)
  }

  const bodyMaterial = new MeshStandardMaterial({
    map: label,
    color: '#ffffff',
    metalness: 0.55,
    roughness: 0.36
  })
  const baseMaterial = createAluminium()
  const lidMaterial = createAluminium()
  const tabMaterial = createAluminium()

  const bodyGeometry = new LatheGeometry(toVectors(bodyPoints), 96)
  const baseGeometry = new LatheGeometry(toVectors(basePoints), 96)
  const lidGeometry = new LatheGeometry(toVectors(lidPoints), 96)
  const tabGeometry = new TorusGeometry(radius * 0.2, radius * 0.028, 8, 24)

  const body = new Mesh(bodyGeometry, bodyMaterial)
  const base = new Mesh(baseGeometry, baseMaterial)
  const lid = new Mesh(lidGeometry, lidMaterial)

  const tab = new Mesh(tabGeometry, tabMaterial)
  tab.rotation.x = -Math.PI / 2
  tab.position.set(radius * 0.18, 0.973, 0)

  // inner group holds the can standing on its base at the origin, +Y up
  const can3d = new Group()
  can3d.add(body, base, lid, tab)
  can3d.scale.setScalar(can.scale / canHeight)

  // Centre the can on the target instead of standing it on top: the lathe runs
  // from y=0 to y=1, so drop it half a can. Then push the axis one radius back
  // along -Z, because the label is printed on the can's FRONT surface — that
  // surface is what MindAR matched, so it belongs in the target plane while the
  // axis sits a radius behind it.
  can3d.position.set(0, -0.5 * can.scale, -radius * can.scale)

  const object = new Group()
  object.add(can3d)
  object.name = `can:${can.id}`

  const geometries = [bodyGeometry, baseGeometry, lidGeometry, tabGeometry]
  const materials = [bodyMaterial, baseMaterial, lidMaterial, tabMaterial]
  const textures: Texture[] = [label]

  const dispose = () => {
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    textures.forEach((texture) => texture.dispose())
    object.clear()
    can3d.clear()
  }

  return { object, dispose }
}

/** the spinnable child, so callers can rotate the can without fighting the tilt */
export const getSpinTarget = (model: CanModel) => model.object.children[0] as Group
