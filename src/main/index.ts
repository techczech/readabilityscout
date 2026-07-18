import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join, basename } from 'node:path'
import { readFileSync, statSync, watch, writeFileSync, type FSWatcher } from 'node:fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC, type FileReadResult, type Settings } from '../shared/ipc'
import { addRecent, clearRecents, loadChangelog, loadRecents, loadSettings, resetSetting, setSetting } from './settings'

const MAX_FILE_BYTES = 2 * 1024 * 1024 // readability formulas are meaningless past this anyway

let mainWindow: BrowserWindow | null = null
let watcher: FSWatcher | null = null
let watchedPath: string | null = null
let reloadTimer: NodeJS.Timeout | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 680,
    show: false,
    title: 'ReadabilityScout',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
    stopWatching()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/* --- File reading (never writing; ADR 0002) --- */

function readTextFile(path: string): FileReadResult {
  const name = basename(path)
  try {
    const stat = statSync(path)
    if (!stat.isFile()) return { ok: false, path, name, reason: 'That is a folder, not a file.' }
    if (stat.size > MAX_FILE_BYTES)
      return { ok: false, path, name, reason: `Too large to analyse (${Math.round(stat.size / 1024 / 1024)} MB; limit is 2 MB).` }
    const buf = readFileSync(path)
    if (buf.includes(0)) return { ok: false, path, name, reason: 'This looks like a binary file, not text.' }
    return { ok: true, path, name, content: buf.toString('utf8'), truncated: false }
  } catch {
    return { ok: false, path, name, reason: 'Could not read the file — it may have moved or be unreadable.' }
  }
}

function stopWatching(): void {
  watcher?.close()
  watcher = null
  watchedPath = null
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = null
}

function startWatching(path: string): void {
  stopWatching()
  watchedPath = path
  try {
    watcher = watch(path, () => {
      // Editors often write in bursts; debounce before notifying the renderer.
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        if (mainWindow && watchedPath) mainWindow.webContents.send(IPC.fileChanged, watchedPath)
      }, 250)
    })
    watcher.on('error', stopWatching)
  } catch {
    watcher = null
  }
}

/* --- Menu: keep Edit (clipboard keys) and add File actions --- */

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Text File…',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send(IPC.menuOpen)
        },
        {
          label: 'Reload from Disk',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow?.webContents.send(IPC.menuReload)
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/* --- IPC --- */

function registerIpc(): void {
  ipcMain.handle(IPC.openDialog, async (): Promise<FileReadResult | null> => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open a text file',
      properties: ['openFile'],
      filters: [
        { name: 'Text', extensions: ['txt', 'md', 'markdown', 'text', 'log', 'csv', 'rtf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const read = readTextFile(result.filePaths[0])
    if (read.ok) {
      startWatching(read.path)
      addRecent(read.path, read.name)
    }
    return read
  })

  ipcMain.handle(IPC.readFile, (_e, path: string): FileReadResult => {
    const read = readTextFile(path)
    if (read.ok) {
      startWatching(read.path)
      addRecent(read.path, read.name)
    }
    return read
  })

  ipcMain.handle(IPC.watch, (_e, path: string) => startWatching(path))
  ipcMain.handle(IPC.unwatch, () => stopWatching())

  ipcMain.handle(IPC.getSettings, () => loadSettings())
  ipcMain.handle(IPC.setSetting, (_e, key: keyof Settings, value: unknown) => setSetting(key, value))
  ipcMain.handle(IPC.resetSetting, (_e, key: keyof Settings) => resetSetting(key))
  ipcMain.handle(IPC.getChangelog, () => loadChangelog())
  ipcMain.handle(IPC.getRecents, () => loadRecents())
  ipcMain.handle(IPC.clearRecents, () => clearRecents())

  ipcMain.handle(IPC.saveExport, async (_e, defaultName: string, content: string): Promise<string | null> => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultName })
    if (result.canceled || !result.filePath) return null
    try {
      writeFileSync(result.filePath, content, 'utf8')
      return result.filePath
    } catch {
      return null
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('net.dominiklukes.readabilityscout')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  buildMenu()
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
