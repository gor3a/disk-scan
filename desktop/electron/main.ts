import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, dirname } from 'node:path'
import { existsSync, writeFileSync } from 'node:fs'
import { Sidecar } from './sidecar'
import { createSplash } from './splash'
import { Store } from './store'
import { applySchedule, type Cadence } from './schedule'
import { initUpdater } from './updater'
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

// Wire the custom title bar's window controls (frame:false) and keep the
// renderer's maximize/restore icon in sync with the real window state.
function registerWindowControls(w: BrowserWindow) {
  ipcMain.on('dscan:win:minimize', () => w.minimize())
  ipcMain.on('dscan:win:maximize', () => (w.isMaximized() ? w.unmaximize() : w.maximize()))
  ipcMain.on('dscan:win:close', () => w.close())
  const sync = () => !w.isDestroyed() && w.webContents.send('dscan:win:maximized', w.isMaximized())
  w.on('maximize', sync)
  w.on('unmaximize', sync)
  w.webContents.on('did-finish-load', sync)
}

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
    minWidth: 720,
    minHeight: 520,
    show: false,
    frame: false, // custom in-app title bar (TopBar) with our own window controls
    backgroundColor: '#f4efe6',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  registerWindowControls(win)
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
      if (process.env.DSCAN_SHOT_JS) {
        await win!.webContents.executeJavaScript(process.env.DSCAN_SHOT_JS)
        await new Promise((r) => setTimeout(r, 400))
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

  initUpdater(win)
}

ipcMain.on('dscan:send', (_e, req: Request) => sidecar?.send(req))

// Open external links (e.g. the Ko-fi donation page) in the user's browser.
// Restricted to https to avoid opening arbitrary schemes from the renderer.
ipcMain.on('dscan:openExternal', (_e, url: string) => {
  if (typeof url === 'string' && url.startsWith('https://')) shell.openExternal(url)
})

ipcMain.handle('dscan:appInfo', () => ({
  version: app.getVersion(),
  platform: process.platform,
  isPackaged: app.isPackaged,
}))

ipcMain.on('dscan:reveal', (_e, p: string) => {
  if (typeof p === 'string' && p) shell.showItemInFolder(p)
})

ipcMain.handle('dscan:uninstall', async () => {
  if (!app.isPackaged) return { ok: false, reason: 'dev' as const }

  // dscan's own data.
  const paths = [app.getPath('userData')]
  if (process.platform === 'darwin') {
    const home = app.getPath('home')
    paths.push(
      join(home, 'Library', 'Caches', 'com.gor3a.dscan'),
      join(home, 'Library', 'Preferences', 'com.gor3a.dscan.plist'),
      join(home, 'Library', 'Logs', 'com.gor3a.dscan'),
    )
  }

  // The app itself.
  let appPath = ''
  if (process.platform === 'darwin') {
    appPath = dirname(dirname(dirname(app.getPath('exe')))) // …/dscan.app/Contents/MacOS/dscan -> dscan.app
  } else if (process.env.APPIMAGE) {
    appPath = process.env.APPIMAGE
  } else {
    return { ok: false, reason: 'managed' as const } // e.g. .deb — needs the package manager
  }

  for (const p of paths) if (existsSync(p)) await shell.trashItem(p).catch(() => {})
  if (existsSync(appPath)) await shell.trashItem(appPath).catch(() => {})
  setTimeout(() => app.quit(), 200)
  return { ok: true as const }
})

const store = new Store(app.getPath('userData'))
ipcMain.handle('dscan:getSettings', () => store.getSettings())
ipcMain.handle('dscan:setSettings', (_e, partial) => store.setSettings(partial))
ipcMain.handle('dscan:getHistory', () => store.getHistory())
ipcMain.handle('dscan:addHistory', (_e, entry) => store.addHistory(entry))
ipcMain.handle('dscan:setSchedule', (_e, opts: { cadence: Cadence; autoClean: boolean }) =>
  applySchedule(opts.cadence, opts.autoClean, resolveSidecar()),
)

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
