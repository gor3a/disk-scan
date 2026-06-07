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
  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-paper ${
        danger ? 'text-[#b91c1c]' : 'text-ink'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="absolute right-4 top-12 z-20 w-44 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      {item('✉  Contact us', onContact)}
      {item('☕  Support', onSupport)}
      {item('⚙  Settings', onSettings)}
      {item('ⓘ  About', onAbout)}
      <div className="border-t border-line" />
      {item('🗑  Uninstall dscan', onUninstall, true)}
    </div>
  )
}
