// Poller — periodically read powersched jobs and push them to listeners.
// Reads need no elevation, so this runs quietly in the background.

import type { CommandBridge } from './ps-bridge'
import type { Job } from '../src/lib/powersched'

export class Poller {
  private timer?: ReturnType<typeof setInterval>
  private last: Job[] = []

  constructor(
    private bridge: CommandBridge,
    private onJobs: (jobs: Job[]) => void,
    private intervalMs = 5000,
  ) {}

  start(): void {
    void this.tick()
    this.timer = setInterval(() => void this.tick(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  refresh(): Promise<void> {
    return this.tick()
  }

  get jobs(): Job[] {
    return this.last
  }

  private async tick(): Promise<void> {
    this.last = await this.bridge.list()
    this.onJobs(this.last)
  }
}
