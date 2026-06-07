import { MoreHorizontal } from 'lucide-react'
import { Mark } from './Mark'

export function TopBar({ onToggleMenu }: { onToggleMenu: () => void }) {
  return (
    <header className="flex items-center gap-2.5 border-b border-line px-5 py-2.5">
      <Mark size={22} />
      <span className="font-display text-[17px] text-ink">dscan</span>
      <button
        onClick={onToggleMenu}
        aria-label="Menu"
        className="ml-auto rounded-lg px-2 py-1 leading-none text-ink-soft hover:bg-paper hover:text-ink"
      >
        <MoreHorizontal size={18} strokeWidth={1.75} />
      </button>
    </header>
  )
}
