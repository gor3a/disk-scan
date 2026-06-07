import { autoUpdater } from 'electron-updater'
import { app, ipcMain, shell, type BrowserWindow } from 'electron'
import type { UpdateStatus } from '../src/lib/update'

const RELEASES_URL = 'https://github.com/gor3a/disk-scan/releases/latest'

// initUpdater registers update IPC handlers (always) and, in packaged builds,
// wires electron-updater to check GitHub on launch + every 6h and forward
// status to the renderer. Linux auto-downloads; macOS only notifies (unsigned).
export function initUpdater(win: BrowserWindow) {
  ipcMain.handle('dscan:update:check', () => autoUpdater.checkForUpdates().catch(() => undefined))
  ipcMain.handle('dscan:update:install', () => {
    try {
      autoUpdater.quitAndInstall()
    } catch {
      /* not downloaded / dev */
    }
  })
  ipcMain.handle('dscan:update:openReleases', () => shell.openExternal(RELEASES_URL))

  if (!app.isPackaged) return

  autoUpdater.autoDownload = process.platform === 'linux'
  autoUpdater.autoInstallOnAppQuit = true

  const send = (s: UpdateStatus) => {
    if (!win.isDestroyed()) win.webContents.send('dscan:update', s)
  }
  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (i) => send({ state: 'available', version: i.version }))
  autoUpdater.on('update-not-available', () => send({ state: 'none' }))
  autoUpdater.on('download-progress', (p) => send({ state: 'downloading', percent: p.percent }))
  autoUpdater.on('update-downloaded', (i) => send({ state: 'downloaded', version: i.version }))
  autoUpdater.on('error', () => send({ state: 'error' }))

  setTimeout(() => autoUpdater.checkForUpdates().catch(() => undefined), 8000)
  setInterval(() => autoUpdater.checkForUpdates().catch(() => undefined), 6 * 60 * 60 * 1000)
}
