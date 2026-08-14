export type CameraProblem =
  | 'insecureContext'
  | 'unsupported'
  | 'denied'
  | 'notFound'
  | 'inUse'
  | 'unknown'

export type CameraProblemCopy = {
  title: string
  body: string
  /** whether offering a retry button makes any sense */
  retryable: boolean
}

/**
 * Camera access fails in several genuinely different ways and the fix differs
 * every time, so never collapse these into one "camera error" message.
 */
export const classifyCameraError = (error: unknown): CameraProblem => {
  if (!window.isSecureContext) return 'insecureContext'
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'

  const name = error instanceof Error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'notFound'
    case 'NotReadableError':
    case 'AbortError':
      return 'inUse'
    default:
      return 'unknown'
  }
}

export const cameraProblemCopy: Record<CameraProblem, CameraProblemCopy> = {
  insecureContext: {
    title: 'Needs a secure connection',
    body: 'Cameras only work over https. Open this page on its https:// address rather than a plain http one.',
    retryable: false
  },
  unsupported: {
    title: 'Camera not supported',
    body: 'This browser does not expose a camera api. Try Safari on iOS or Chrome on Android.',
    retryable: false
  },
  denied: {
    title: 'Camera permission blocked',
    body: 'Allow camera access for this site in your browser settings, then try again.',
    retryable: true
  },
  notFound: {
    title: 'No camera found',
    body: 'No rear-facing camera was available on this device.',
    retryable: true
  },
  inUse: {
    title: 'Camera unavailable',
    body: 'Another app or tab is using the camera. Close it and try again.',
    retryable: true
  },
  unknown: {
    title: 'Could not start the camera',
    body: 'Something went wrong starting the camera.',
    retryable: true
  }
}

export const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value))
