import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Job, Result, ScheduleRequest } from '../../lib/powersched'
import { makeToast, type Toast } from '../../lib/powersched'
import { JobList } from './JobList'
import { ScheduleForm } from './ScheduleForm'
import { Toasts } from './Toasts'

/** The Schedule tab body. Drives the powersched CLI via window.powersched.* */
export function ScheduleView() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))
  const [toasts, setToasts] = useState<Toast[]>([])
  const [missing, setMissing] = useState<string | null>(null)

  useEffect(() => {
    void window.powersched.list().then(setJobs)
    const unsub = window.powersched.onJobs(setJobs)
    void window.powersched.health().then((h) => setMissing(h.found ? null : h.path))
    return () => unsub()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  const pushToast = useCallback((kind: 'ok' | 'err', message: string) => {
    const toast = makeToast(kind, message)
    setToasts((cur) => [...cur, toast])
    setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== toast.id)), 4500)
  }, [])

  const report = useCallback((r: Result) => pushToast(r.ok ? 'ok' : 'err', r.message), [pushToast])

  const doSchedule = useCallback(
    async (req: ScheduleRequest) => report(await window.powersched.schedule(req)),
    [report],
  )
  const doCancel = useCallback(
    async (id: string) => report(await window.powersched.cancel(id)),
    [report],
  )
  const doCancelAll = useCallback(
    async () => report(await window.powersched.cancel('all')),
    [report],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {missing && (
        <div className="flex items-center gap-2 border-b border-[#b91c1c]/30 bg-[#b91c1c]/10 px-5 py-2 text-sm text-[#b91c1c]">
          <AlertTriangle size={15} className="shrink-0" />
          <span>
            powersched CLI not found at <span className="font-mono">{missing}</span> — scheduling is
            unavailable.
          </span>
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr] gap-5 p-5">
        <JobList jobs={jobs} now={now} onCancel={doCancel} onCancelAll={doCancelAll} />
        <ScheduleForm onSchedule={doSchedule} />
      </div>
      <Toasts toasts={toasts} />
    </div>
  )
}
