import { X, Zap, Sunrise } from 'lucide-react'
import { describeWhen, formatCountdown, nextFire, type Job } from '../../lib/powersched'
import { actionIcon } from './icons'

export function JobRow({
  job,
  now,
  onCancel,
}: {
  job: Job
  now: number
  onCancel: (id: string) => void
}) {
  const Icon = actionIcon(job.action)
  const fire = nextFire(job, now)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-card">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium capitalize text-ink">{job.action.replace('-', ' ')}</span>
          {job.force && (
            <span className="inline-flex items-center gap-1 rounded bg-review-bg px-1.5 py-0.5 text-[11px] font-medium text-review">
              <Zap size={11} /> force
            </span>
          )}
          {job.wakeAt && (
            <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-[11px] font-medium text-accent">
              <Sunrise size={11} /> wake
            </span>
          )}
        </div>
        <div className="truncate font-mono text-xs text-ink-soft">{describeWhen(job)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm tabular-nums text-ink">{formatCountdown(fire, now)}</div>
        <div className="text-[11px] uppercase tracking-wide text-ink-soft">{job.kind}</div>
      </div>
      <button
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-ink-soft hover:text-ink"
        title={`Cancel ${job.id}`}
        onClick={() => onCancel(job.id)}
      >
        <X size={15} />
      </button>
    </div>
  )
}
