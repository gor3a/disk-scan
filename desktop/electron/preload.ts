import { contextBridge, ipcRenderer } from 'electron'
import type { DscanEvent, Request } from '../src/lib/protocol'

contextBridge.exposeInMainWorld('dscan', {
  send: (req: Request) => ipcRenderer.send('dscan:send', req),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dscan:pickFolder'),
  openExternal: (url: string) => ipcRenderer.send('dscan:openExternal', url),
  getSettings: () => ipcRenderer.invoke('dscan:getSettings'),
  setSettings: (partial: unknown) => ipcRenderer.invoke('dscan:setSettings', partial),
  getHistory: () => ipcRenderer.invoke('dscan:getHistory'),
  addHistory: (entry: unknown) => ipcRenderer.invoke('dscan:addHistory', entry),
  onEvent: (cb: (e: DscanEvent) => void) => {
    const handler = (_: unknown, e: DscanEvent) => cb(e)
    ipcRenderer.on('dscan:event', handler)
    return () => ipcRenderer.removeListener('dscan:event', handler)
  },
})
