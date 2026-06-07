import { Coffee } from 'lucide-react'
import { Modal } from './Modal'
import { Mark } from './Mark'
import { humanBytes } from '../lib/format'

export function AboutModal({
  version,
  reclaimedAllTime,
  cleans,
  onClose,
  onContact,
  onSupport,
}: {
  version: string
  reclaimedAllTime: number
  cleans: number
  onClose: () => void
  onContact: () => void
  onSupport: () => void
}) {
  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <Mark size={56} />
        <h2 className="mt-3 font-display text-2xl text-ink">dscan</h2>
        <p className="text-sm text-ink-soft">v{version}</p>
        <p className="mt-3 text-[13px] text-ink-soft">
          You've reclaimed <b className="text-safe">{humanBytes(reclaimedAllTime)}</b> across {cleans}{' '}
          clean{cleans === 1 ? '' : 's'}.
        </p>
        <div className="mt-5 flex gap-3 text-[13px] font-semibold text-accent">
          <button onClick={onContact}>Contact</button>
          <button onClick={onSupport} className="inline-flex items-center gap-1.5">
            <Coffee size={14} strokeWidth={1.75} /> Support
          </button>
        </div>
        <button onClick={onClose} className="mt-5 text-[13px] text-ink-soft underline underline-offset-4">
          Close
        </button>
      </div>
    </Modal>
  )
}
