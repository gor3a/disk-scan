export type CheckState = 'on' | 'off' | 'mixed' | 'locked'

const CHECK = 'M3.5 7.5l2.5 2.5 5-6'

export function Check({
  state,
  onClick,
}: {
  state: CheckState
  onClick?: () => void
}) {
  const base =
    'w-[19px] h-[19px] rounded-[6px] border flex items-center justify-center transition-all duration-150 shrink-0'

  if (state === 'locked') {
    return (
      <span className={`${base} border-line bg-keep-bg text-keep`} aria-label="protected">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <rect x="2.2" y="5" width="7.6" height="5.5" rx="1.3" fill="currentColor" />
          <path d="M3.7 5V3.6a2.3 2.3 0 014.6 0V5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </span>
    )
  }

  const filled = state === 'on' || state === 'mixed'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-checked={state === 'on' ? 'true' : state === 'mixed' ? 'mixed' : 'false'}
      role="checkbox"
      className={`${base} ${
        filled
          ? 'bg-accent border-accent text-white shadow-[0_2px_6px_-2px_rgba(31,122,92,0.6)]'
          : 'border-line bg-surface hover:border-ink-soft'
      }`}
    >
      {state === 'on' && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d={CHECK} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {state === 'mixed' && <span className="w-2.5 h-[2px] bg-white rounded-full" />}
    </button>
  )
}
