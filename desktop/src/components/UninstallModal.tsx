import { useState } from 'react'
import { Modal } from './Modal'

export function UninstallModal({ onClose }: { onClose: () => void }) {
  const [msg, setMsg] = useState<string | null>(null)
  const run = async () => {
    const r = await window.dscan.uninstall()
    if (r.ok) return // app quits
    if (r.reason === 'dev') setMsg('Dev build — nothing was removed.')
    else if (r.reason === 'managed')
      setMsg('Installed via a package manager. Remove it with: sudo apt remove dscan')
    else setMsg('Could not uninstall automatically.')
  }
  return (
    <Modal onClose={onClose}>
      <h2 className="font-display text-xl text-ink">Uninstall dscan?</h2>
      <p className="mt-2 text-[13px] text-ink-soft">
        This moves dscan and its saved data to the Trash, then quits. This can't be undone from here.
      </p>
      {msg && (
        <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-[12.5px] text-ink-soft">{msg}</p>
      )}
      <div className="mt-5 flex gap-3">
        <button onClick={run} className="flex-1 rounded-xl bg-[#b91c1c] px-4 py-2.5 font-semibold text-white">
          Uninstall
        </button>
        <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 font-semibold text-ink-soft">
          Cancel
        </button>
      </div>
    </Modal>
  )
}
