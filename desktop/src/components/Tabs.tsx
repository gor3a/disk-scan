import type { Tab } from '../state'

export function Tabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const item = (t: Tab, label: string) => (
    <button
      onClick={() => onTab(t)}
      className={`rounded-t-xl px-5 py-2.5 text-[13px] font-semibold transition-colors ${
        tab === t
          ? 'bg-surface text-accent-deep shadow-[inset_0_-2px_0_var(--accent)]'
          : 'text-ink-soft hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="flex gap-1 px-5 pt-3">
      {item('cleanup', 'Clean up')}
      {item('projects', 'Projects')}
      {item('map', 'Map')}
    </div>
  )
}
