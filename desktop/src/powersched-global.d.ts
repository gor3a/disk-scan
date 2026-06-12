import type { Job, Result, ScheduleRequest } from './lib/powersched'

declare global {
  interface Window {
    powersched: {
      list(): Promise<Job[]>
      schedule(req: ScheduleRequest): Promise<Result>
      cancel(id: string): Promise<Result>
      abort(id: string): Promise<Result>
      health(): Promise<{ path: string; found: boolean }>
      onJobs(cb: (jobs: Job[]) => void): () => void
    }
  }
}

export {}
