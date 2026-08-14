import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { cameraProblemCopy, classifyCameraError, type CameraProblem } from '../ar/cameraErrors'
import { Message } from './Message'

type GateState =
  | { phase: 'checking' }
  | { phase: 'prompting' }
  | { phase: 'granted' }
  | { phase: 'blocked'; problem: CameraProblem }

type CameraGateProps = {
  children: ReactNode
}

/**
 * Resolves camera permission BEFORE the AR scene mounts.
 *
 * MindAR calls getUserMedia itself, but it surfaces failures as an opaque
 * console error mid-boot. Asking first means a denied or unsupported device
 * gets a real explanation instead of a black screen. Once granted, MindAR's own
 * request resolves from the existing permission with no second prompt.
 */
export const CameraGate = ({ children }: CameraGateProps) => {
  const [state, setState] = useState<GateState>({ phase: 'checking' })

  const request = useCallback(async () => {
    if (!window.isSecureContext) {
      setState({ phase: 'blocked', problem: 'insecureContext' })
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ phase: 'blocked', problem: 'unsupported' })
      return
    }

    setState({ phase: 'prompting' })
    try {
      // rear camera; released immediately because MindAR opens its own stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      stream.getTracks().forEach((track) => track.stop())
      setState({ phase: 'granted' })
    } catch (cause) {
      setState({ phase: 'blocked', problem: classifyCameraError(cause) })
    }
  }, [])

  useEffect(() => {
    void request()
  }, [request])

  if (state.phase === 'granted') return <>{children}</>

  if (state.phase === 'blocked') {
    const copy = cameraProblemCopy[state.problem]
    return (
      <Message
        title={copy.title}
        body={copy.body}
        {...(copy.retryable ? { actionLabel: 'Try again', onAction: () => void request() } : {})}
      />
    )
  }

  return (
    <Message
      title="AR Soda Cans"
      body={
        state.phase === 'prompting'
          ? 'Allow camera access to start scanning.'
          : 'Checking camera support…'
      }
    />
  )
}
