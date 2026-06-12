import { contextBridge, ipcRenderer } from 'electron'
import type { DscanEvent, Request } from '../src/lib/protocol'
import type {
  Job as PsJob,
  Result as PsResult,
  ScheduleRequest as PsScheduleRequest,
} from '../src/lib/powersched'

contextBridge.exposeInMainWorld('dscan', {
  send: (req: Request) => ipcRenderer.send('dscan:send', req),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dscan:pickFolder'),
  openExternal: (url: string) => ipcRenderer.send('dscan:openExternal', url),
  appInfo: () => ipcRenderer.invoke('dscan:appInfo'),
  reveal: (p: string) => ipcRenderer.send('dscan:reveal', p),
  findNative: (name: string) => ipcRenderer.invoke('dscan:findNative', name),
  uninstall: () => ipcRenderer.invoke('dscan:uninstall'),
  getSettings: () => ipcRenderer.invoke('dscan:getSettings'),
  setSettings: (partial: unknown) => ipcRenderer.invoke('dscan:setSettings', partial),
  getHistory: () => ipcRenderer.invoke('dscan:getHistory'),
  addHistory: (entry: unknown) => ipcRenderer.invoke('dscan:addHistory', entry),
  setSchedule: (opts: { cadence: 'off' | 'daily' | 'weekly'; autoClean: boolean }) =>
    ipcRenderer.invoke('dscan:setSchedule', opts),
  update: {
    onStatus: (cb: (s: unknown) => void) => {
      const h = (_: unknown, s: unknown) => cb(s)
      ipcRenderer.on('dscan:update', h)
      return () => ipcRenderer.removeListener('dscan:update', h)
    },
    check: () => ipcRenderer.invoke('dscan:update:check'),
    install: () => ipcRenderer.invoke('dscan:update:install'),
    openReleases: () => ipcRenderer.invoke('dscan:update:openReleases'),
  },
  win: {
    minimize: () => ipcRenderer.send('dscan:win:minimize'),
    maximize: () => ipcRenderer.send('dscan:win:maximize'),
    close: () => ipcRenderer.send('dscan:win:close'),
    onMaximized: (cb: (max: boolean) => void) => {
      const h = (_: unknown, max: boolean) => cb(max)
      ipcRenderer.on('dscan:win:maximized', h)
      return () => ipcRenderer.removeListener('dscan:win:maximized', h)
    },
  },
  onEvent: (cb: (e: DscanEvent) => void) => {
    const handler = (_: unknown, e: DscanEvent) => cb(e)
    ipcRenderer.on('dscan:event', handler)
    return () => ipcRenderer.removeListener('dscan:event', handler)
  },
})

// powersched (Schedule tab) — separate typed surface; no Node, no raw ipc.
contextBridge.exposeInMainWorld('powersched', {
  list: (): Promise<PsJob[]> => ipcRenderer.invoke('ps:list'),
  schedule: (req: PsScheduleRequest): Promise<PsResult> => ipcRenderer.invoke('ps:schedule', req),
  cancel: (id: string): Promise<PsResult> => ipcRenderer.invoke('ps:cancel', id),
  abort: (id: string): Promise<PsResult> => ipcRenderer.invoke('ps:abort', id),
  health: (): Promise<{ path: string; found: boolean }> => ipcRenderer.invoke('ps:health'),
  onJobs: (cb: (jobs: PsJob[]) => void) => {
    const h = (_: unknown, jobs: PsJob[]) => cb(jobs)
    ipcRenderer.on('ps:jobs', h)
    return () => ipcRenderer.removeListener('ps:jobs', h)
  },
})
