import { app, BrowserWindow, ipcMain } from 'electron'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Sidecar } from './sidecar'
import type { Request } from '../src/lib/protocol'

const __dirname = dirname(fileURLToPath(import.meta.url))

// resolveSidecar: when packaged, use the binary shipped under resources/ by
// electron-builder; in dev, use the repo-built `desktop/dscan-dev` binary.
function resolveSidecar(): string {
  const packaged = join(process.resourcesPath, 'dscan')
  if (app.isPackaged && existsSync(packaged)) return packaged
  return join(__dirname, '..', 'dscan-dev')
}

let win: BrowserWindow | null = null
let sidecar: Sidecar | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 920,
    height: 680,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.once('ready-to-show', () => win?.show())

  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL)
  else win.loadFile(join(__dirname, '..', 'dist', 'index.html'))

  sidecar = new Sidecar(resolveSidecar())
  sidecar.on('event', (e) => win?.webContents.send('dscan:event', e))
  sidecar.start()
}

ipcMain.on('dscan:send', (_e, req: Request) => sidecar?.send(req))

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  sidecar?.stop()
  app.quit()
})
