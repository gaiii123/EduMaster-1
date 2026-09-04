import './MasteryCard.css';

/**
 * Compact card showing a single mastery dimension with a progress bar.
 *
 * @param {{ label: string, score: number }} props
 */
function MasteryCard({ label, score }) {
  const clamped = Math.max(0, Math.min(100, score));

  // Colour shifts from red → amber → green as mastery increases
  const colour =
    clamped >= 70 ? 'var(--success)' : clamped >= 40 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="mastery-card">
      <div className="mastery-card__header">
        <span className="mastery-card__label">{label}</span>
        <span className="mastery-card__score" style={{ color: colour }}>{clamped}</span>
      </div>
      <div className="mastery-card__track">
        <div
          className="mastery-card__fill"
          style={{ width: `${clamped}%`, background: colour }}
        />
      </div>
    </div>
  );
}

export default MasteryCard;
