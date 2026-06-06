import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { Sidecar } from './sidecar'
import { createSplash } from './splash'
import type { Request } from '../src/lib/protocol'

const SPLASH_MIN_MS = 1100 // keep the brand moment visible even on fast loads

// resolveSidecar: when packaged, use the binary shipped under resources/ by
// electron-builder; in dev, use the repo-built `desktop/dscan-dev` binary.
function resolveSidecar(): string {
  const packaged = join(process.resourcesPath, 'dscan')
  if (app.isPackaged && existsSync(packaged)) return packaged
  return join(__dirname, '..', 'dscan-dev')
}

let win: BrowserWindow | null = null
let splash: BrowserWindow | null = null
let sidecar: Sidecar | null = null

function createWindow() {
  // Show our icon in the macOS dock during dev (packaged builds get it from
  // electron-builder).
  if (process.platform === 'darwin' && !app.isPackaged) {
    const devIcon = join(__dirname, '..', 'build', 'icon.png')
    if (existsSync(devIcon)) app.dock?.setIcon(devIcon)
  }

  splash = createSplash()
  const shownAt = Date.now()

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
  win.once('ready-to-show', () => {
    const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - shownAt))
    setTimeout(() => {
      win?.show()
      splash?.close()
      splash = null
    }, wait)
  })

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
