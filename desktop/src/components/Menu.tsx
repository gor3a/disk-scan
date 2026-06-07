import { type ReactNode } from 'react'
import { Mail, Coffee, Settings, Info, Trash2 } from 'lucide-react'

export function Menu({
  onContact,
  onSupport,
  onAbout,
  onSettings,
  onUninstall,
}: {
  onContact: () => void
  onSupport: () => void
  onAbout: () => void
  onSettings: () => void
  onUninstall: () => void
}) {
  const item = (icon: ReactNode, label: string, onClick: () => void, danger = false) => (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-paper ${
        danger ? 'text-[#b91c1c]' : 'text-ink'
      }`}
    >
      {icon}
      {label}
    </button>
  )
  const ic = { size: 15, strokeWidth: 1.75 } as const
  return (
    <div className="absolute right-4 top-12 z-20 w-44 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      {item(<Mail {...ic} />, 'Contact us', onContact)}
      {item(<Coffee {...ic} />, 'Support', onSupport)}
      {item(<Settings {...ic} />, 'Settings', onSettings)}
      {item(<Info {...ic} />, 'About', onAbout)}
      <div className="border-t border-line" />
      {item(<Trash2 {...ic} />, 'Uninstall dscan', onUninstall, true)}
    </div>
  )
}
