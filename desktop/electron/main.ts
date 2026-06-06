import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'node:path'
import { existsSync, writeFileSync } from 'node:fs'
import { Sidecar } from './sidecar'
import { createSplash } from './splash'
import { Store } from './store'
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

  // Docs utility: DSCAN_SHOT=<path> captures the rendered window to a PNG once
  // the scan has settled, then exits. Used to regenerate the README screenshot.
  if (process.env.DSCAN_SHOT) {
    win.webContents.once('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 3000))
      // Optionally switch to a named tab (e.g. DSCAN_SHOT_TAB=Projects) and let
      // its scan stream before capturing.
      if (process.env.DSCAN_SHOT_TAB) {
        await win!.webContents.executeJavaScript(
          `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(
            process.env.DSCAN_SHOT_TAB,
          )})?.click()`,
        )
        await new Promise((r) => setTimeout(r, 4000))
      }
      const img = await win!.webContents.capturePage()
      writeFileSync(process.env.DSCAN_SHOT!, img.toPNG())
    })
  }

  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL)
  else win.loadFile(join(__dirname, '..', 'dist', 'index.html'))

  sidecar = new Sidecar(resolveSidecar())
  sidecar.on('event', (e) => win?.webContents.send('dscan:event', e))
  sidecar.start()
}

ipcMain.on('dscan:send', (_e, req: Request) => sidecar?.send(req))

// Open external links (e.g. the Ko-fi donation page) in the user's browser.
// Restricted to https to avoid opening arbitrary schemes from the renderer.
ipcMain.on('dscan:openExternal', (_e, url: string) => {
  if (typeof url === 'string' && url.startsWith('https://')) shell.openExternal(url)
})

const store = new Store(app.getPath('userData'))
ipcMain.handle('dscan:getSettings', () => store.getSettings())
ipcMain.handle('dscan:setSettings', (_e, partial) => store.setSettings(partial))
ipcMain.handle('dscan:getHistory', () => store.getHistory())
ipcMain.handle('dscan:addHistory', (_e, entry) => store.addHistory(entry))

ipcMain.handle('dscan:pickFolder', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    defaultPath: app.getPath('home'),
  })
  return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0]
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  sidecar?.stop()
  app.quit()
})
