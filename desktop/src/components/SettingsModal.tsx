import { Modal } from './Modal'
import type { Settings } from '../state'

export function SettingsModal({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings
  onChange: (s: Settings) => void
  onClose: () => void
}) {
  return (
    <Modal onClose={onClose}>
      <h2 className="font-display text-xl text-ink">Settings</h2>

      <div className="mt-5 text-[13px] font-semibold text-ink">Appearance</div>
      <div className="mt-2 flex gap-1 rounded-xl border border-line bg-paper p-1">
        {(['system', 'light', 'dark'] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => onChange({ ...settings, theme: opt })}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold capitalize transition-colors ${
              (settings.theme ?? 'system') === opt
                ? 'bg-surface text-accent shadow-card'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <label className="mt-5 block text-[13px] font-semibold text-ink">
        Auto-select projects older than
        <span className="ml-2 font-mono text-accent">{settings.staleDays} days</span>
      </label>
      <input
        type="range"
        min={7}
        max={365}
        step={1}
        value={settings.staleDays}
        onChange={(e) => onChange({ ...settings, staleDays: Number(e.target.value) })}
        className="mt-2 w-full accent-[#1f7a5c]"
      />
      <p className="mt-1 text-[12px] text-ink-soft">
        Projects in the Projects tab untouched for longer than this are pre-checked.
      </p>
      <button
        onClick={onClose}
        className="mt-6 w-full rounded-xl bg-accent px-4 py-2.5 font-semibold text-white"
      >
        Done
      </button>
    </Modal>
  )
}
