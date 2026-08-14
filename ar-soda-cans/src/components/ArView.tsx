import { useArScene } from '../ar/useArScene'
import { cameraProblemCopy, classifyCameraError } from '../ar/cameraErrors'
import { CanInfoCard } from './CanInfoCard'
import { Message } from './Message'
import { ScanHint } from './ScanHint'

/**
 * The AR surface. The container div is handed to MindAR, which appends the
 * video and webgl canvas into it — react must never render children there, so
 * all ui sits in a sibling overlay.
 */
export const ArView = () => {
  const { containerRef, status, activeCan, error, retry } = useArScene()

  return (
    <div className="ar-view">
      <div className="ar-view__stage" ref={containerRef} />

      <div className="ar-view__overlay">
        {status === 'starting' && (
          <div className="ar-view__loading">
            <span className="spinner" aria-hidden />
            <p>Starting camera…</p>
          </div>
        )}

        {status === 'running' && (
          <>
            <ScanHint visible={!activeCan} />
            <CanInfoCard can={activeCan} />
          </>
        )}
      </div>

      {status === 'error' && error && <ArError error={error} onRetry={retry} />}
    </div>
  )
}

const ArError = ({ error, onRetry }: { error: Error; onRetry: () => void }) => {
  // a failed fetch of targets.mind is by far the most likely first-run failure,
  // and it is a setup problem rather than a camera one
  const isMissingTargets = /targets\.mind|fetch|404/i.test(error.message)
  const copy = cameraProblemCopy[classifyCameraError(error)]

  return isMissingTargets ? (
    <Message
      title="No targets compiled"
      body="public/targets.mind is missing or unreadable. Add your can photos to public/targets/ and run: npm run compile:targets"
      actionLabel="Try again"
      onAction={onRetry}
    />
  ) : (
    <Message title={copy.title} body={copy.body} actionLabel="Try again" onAction={onRetry} />
  )
}
