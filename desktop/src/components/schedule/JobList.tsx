import { CalendarClock, Ban } from 'lucide-react'
import { sortedJobs, visibleJobs, type Job } from '../../lib/powersched'
import { JobRow } from './JobRow'

export function JobList({
  jobs,
  now,
  onCancel,
  onCancelAll,
}: {
  jobs: Job[]
  now: number
  onCancel: (id: string) => void
  onCancelAll: () => void
}) {
  const visible = sortedJobs(visibleJobs(jobs, now), now)

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg text-ink">
          <CalendarClock size={18} className="text-accent" /> Scheduled
        </h2>
        {visible.length > 0 && (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft hover:text-ink"
            onClick={onCancelAll}
          >
            <Ban size={13} /> Cancel all
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-line text-sm text-ink-soft">
            No scheduled events
          </div>
        ) : (
          visible.map((j) => <JobRow key={j.id} job={j} now={now} onCancel={onCancel} />)
        )}
      </div>
    </section>
  )
}
