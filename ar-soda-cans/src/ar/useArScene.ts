import { useEffect, useRef, useState } from 'react'
import { startArScene, type ArScene } from './arScene'
import { toError } from './cameraErrors'
import type { Can } from '../data/cans'

export type ArStatus = 'starting' | 'running' | 'error'

/**
 * Bridges the imperative MindAR/three scene into react.
 *
 * React never renders into the AR container — it only supplies the element and
 * reacts to tracking events.
 *
 * Starting is async, which makes overlapping mounts the hazard here. StrictMode
 * double-mounts effects in development: without serialisation, the cleanup for
 * mount 1 runs before its scene exists, mount 2 starts a second scene into the
 * same container, and mount 1's teardown then lands on top of it — two camera
 * streams, and a video element torn out of the DOM. Every start and stop
 * therefore goes through one promise chain, so they strictly alternate.
 */
export const useArScene = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const [status, setStatus] = useState<ArStatus>('starting')
  const [activeCan, setActiveCan] = useState<Can | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let scene: ArScene | null = null

    setStatus('starting')
    setError(null)

    // wait for any previous scene to finish tearing down before touching the
    // camera or the container
    const startPromise = chainRef.current.then(async () => {
      if (cancelled) return
      try {
        const started = await startArScene(container, {
          onActiveCanChange: (can) => {
            if (!cancelled) setActiveCan(can)
          }
        })
        if (cancelled) {
          started.stop()
          return
        }
        scene = started
        setStatus('running')
      } catch (cause: unknown) {
        if (cancelled) return
        setError(toError(cause))
        setStatus('error')
      }
    })

    chainRef.current = startPromise

    return () => {
      cancelled = true
      // queue the stop behind the start so it can never run first
      chainRef.current = startPromise.then(() => {
        scene?.stop()
        scene = null
      })
    }
  }, [attempt])

  const retry = () => setAttempt((value) => value + 1)

  return { containerRef, status, activeCan, error, retry }
}
