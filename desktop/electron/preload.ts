import { contextBridge, ipcRenderer } from 'electron'
import type { DscanEvent, Request } from '../src/lib/protocol'

contextBridge.exposeInMainWorld('dscan', {
  send: (req: Request) => ipcRenderer.send('dscan:send', req),
  onEvent: (cb: (e: DscanEvent) => void) => {
    const handler = (_: unknown, e: DscanEvent) => cb(e)
    ipcRenderer.on('dscan:event', handler)
    return () => ipcRenderer.removeListener('dscan:event', handler)
  },
})
