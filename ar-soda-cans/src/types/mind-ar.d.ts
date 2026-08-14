/**
 * mind-ar@1.2.5 ships no type declarations. These cover only the surface this
 * app actually touches.
 */

declare module 'mind-ar/src/image-target/offline-compiler.js' {
  type CompilerImage = { width: number; height: number }

  export class OfflineCompiler {
    compileImageTargets(
      images: CompilerImage[],
      progressCallback: (percent: number) => void
    ): Promise<unknown>
    exportData(): Uint8Array
  }
}

declare module 'mind-ar/src/image-target/image-list.js' {
  type GreyImage = { data: Uint8Array; width: number; height: number }
  /** the target rendered at each scale the detector searches */
  export function buildImageList(target: GreyImage): (GreyImage & { scale: number })[]
}

declare module 'mind-ar/src/image-target/detector/detector.js' {
  import type { Tensor } from '@tensorflow/tfjs'

  export class Detector {
    constructor(width: number, height: number)
    detect(input: Tensor): { featurePoints: { maxima: boolean }[] }
  }
}

declare module 'mind-ar/src/image-target/matching/hierarchical-clustering.js' {
  export function build(options: { points: unknown[] }): unknown
}

declare module 'mind-ar/src/image-target/matching/matcher.js' {
  export class Matcher {
    constructor(queryWidth: number, queryHeight: number, debugMode?: boolean)
    /** keyframeIndex is -1 when nothing matched */
    matchDetection(
      keyframes: unknown[],
      featurePoints: unknown[]
    ): { keyframeIndex: number; screenCoords?: { x: number; y: number }[] }
  }
}

declare module 'mind-ar/src/image-target/detector/kernels/cpu/index.js'

declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from 'three'

  export type MindArAnchor = {
    group: Group
    targetIndex: number
    onTargetFound?: (() => void) | undefined
    onTargetLost?: (() => void) | undefined
  }

  export type MindArThreeOptions = {
    container: HTMLElement
    imageTargetSrc: string
    maxTrack?: number
    uiLoading?: string | boolean
    uiScanning?: string | boolean
    uiError?: string | boolean
    filterMinCF?: number
    filterBeta?: number
    warmupTolerance?: number
    missTolerance?: number
  }

  export class MindARThree {
    constructor(options: MindArThreeOptions)
    renderer: WebGLRenderer
    scene: Scene
    camera: PerspectiveCamera
    video: HTMLVideoElement
    /** css3d renderer; its domElement is appended to the container too */
    cssRenderer: { domElement: HTMLElement }
    addAnchor(targetIndex: number): MindArAnchor
    start(): Promise<void>
    stop(): void
  }
}
