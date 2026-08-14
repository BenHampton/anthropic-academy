type ScanHintProps = {
  visible: boolean
}

/** viewfinder reticle shown while nothing is being tracked */
export const ScanHint = ({ visible }: ScanHintProps) => (
  <div className={`scan-hint ${visible ? 'scan-hint--visible' : ''}`} aria-hidden={!visible}>
    <div className="scan-hint__reticle" />
    <p className="scan-hint__label">Point the camera at a can</p>
  </div>
)
