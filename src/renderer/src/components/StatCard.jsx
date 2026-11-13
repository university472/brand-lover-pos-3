export default function StatCard({
  label,
  value,
  accent = 'indigo',
  hint,
  onClick
}) {
  return (
    <div
      className={`stat-card accent-${accent}` + (onClick ? ' clickable' : '')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
      {onClick && <span className="stat-drill">View details →</span>}
    </div>
  )
}
