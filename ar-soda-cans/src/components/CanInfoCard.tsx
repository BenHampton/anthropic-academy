import type { Can } from '../data/cans'

type CanInfoCardProps = {
  can: Can | null
}

/**
 * Kept mounted whether or not a can is tracked so the card can animate out on
 * target lost rather than vanishing.
 */
export const CanInfoCard = ({ can }: CanInfoCardProps) => (
  <div
    className={`info-card ${can ? 'info-card--visible' : ''}`}
    aria-live="polite"
    aria-hidden={!can}
  >
    {can && (
      <>
        <div className="info-card__swatch" style={{ background: can.bodyColor }} aria-hidden />
        <div className="info-card__text">
          <h2 className="info-card__name">{can.name}</h2>
          <p className="info-card__flavour">{can.flavour}</p>
        </div>
        <dl className="info-card__stats">
          <div className="info-card__stat">
            <dt>kcal</dt>
            <dd>{can.calories}</dd>
          </div>
          <div className="info-card__stat">
            <dt>ml</dt>
            <dd>{can.volumeMl}</dd>
          </div>
        </dl>
      </>
    )}
  </div>
)
