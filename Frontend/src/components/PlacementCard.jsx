import './PlacementCard.css';

/**
 * Renders the AI placement decision for a student:
 * track, level, composite score, velocity, confidence and focus areas.
 *
 * @param {{ placement: object|null, compact?: boolean }} props
 */
function PlacementCard({ placement, compact = false }) {
  if (!placement) {
    return (
      <div className={`placement-card${compact ? ' placement-card--compact' : ''}`}>
        <p className="placement-card__empty">
          No placement yet — run a Baseline Viva to place this student.
        </p>
      </div>
    );
  }

  const {
    composite_score,
    level,
    track,
    velocity_per_week,
    confidence,
    focus_areas,
    evaluations_count,
    message,
  } = placement;

  const velocityLabel =
    velocity_per_week === null || velocity_per_week === undefined
      ? '—'
      : `${velocity_per_week > 0 ? '+' : ''}${velocity_per_week}/wk`;

  const trackClass = `placement-card__track--${track.toLowerCase()}`;

  return (
    <div className={`placement-card${compact ? ' placement-card--compact' : ''}`}>
      <div className="placement-card__head">
        <span className={`placement-card__track ${trackClass}`}>{track}</span>
        <span className="placement-card__level">{level}</span>
        <span className="placement-card__composite" title="Composite mastery score">
          {composite_score}
        </span>
      </div>

      {!compact && <p className="placement-card__message">{message}</p>}

      <div className="placement-card__stats">
        <div className="placement-card__stat" title="Measured growth rate">
          <span className="placement-card__stat-value">{velocityLabel}</span>
          <span className="placement-card__stat-label">Velocity</span>
        </div>
        <div className="placement-card__stat" title="How much we trust this placement">
          <span className="placement-card__stat-value">{Math.round(confidence * 100)}%</span>
          <span className="placement-card__stat-label">Confidence</span>
        </div>
        <div className="placement-card__stat" title="Number of evaluations on record">
          <span className="placement-card__stat-value">{evaluations_count}</span>
          <span className="placement-card__stat-label">Evals</span>
        </div>
      </div>

      {!compact && focus_areas?.length > 0 && (
        <div className="placement-card__focus">
          <span className="placement-card__focus-label">Focus next:</span>
          {focus_areas.map((area) => (
            <span key={area} className="placement-card__chip">{area}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default PlacementCard;
