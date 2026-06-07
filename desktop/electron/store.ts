import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface Settings {
  staleDays: number
  lastProjectRoot?: string
  theme?: 'system' | 'light' | 'dark'
  excludes?: string[]
  schedule?: 'off' | 'daily' | 'weekly'
  scheduleAutoClean?: boolean
}
export interface HistoryEntry {
  at: number
  freed: number
  trashed: number
  items: number
  tab: 'cleanup' | 'projects'
}

const DEFAULT_SETTINGS: Settings = {
  staleDays: 30,
  theme: 'system',
  excludes: [],
  schedule: 'off',
  scheduleAutoClean: false,
}

// Store reads/writes typed JSON files under a base directory (the app's
// userData in production, a temp dir in tests).
export class Store {
  constructor(private base: string) {}

  getSettings(): Settings {
    const p = join(this.base, 'settings.json')
    if (!existsSync(p)) return { ...DEFAULT_SETTINGS }
    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(readFileSync(p, 'utf8')) as object) } as Settings
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }

  setSettings(partial: Partial<Settings>): Settings {
    const next = { ...this.getSettings(), ...partial }
    this.write('settings.json', next)
    return next
  }

  getHistory(): HistoryEntry[] {
    const p = join(this.base, 'history.json')
    if (!existsSync(p)) return []
    try {
      return JSON.parse(readFileSync(p, 'utf8')) as HistoryEntry[]
    } catch {
      return []
    }
  }

  addHistory(entry: HistoryEntry): void {
    this.write('history.json', [...this.getHistory(), entry])
  }

  private write(file: string, obj: unknown): void {
    const p = join(this.base, file)
    const tmp = p + '.tmp'
    writeFileSync(tmp, JSON.stringify(obj, null, 2))
    renameSync(tmp, p)
  }
}
