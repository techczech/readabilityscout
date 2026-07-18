import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type FileReadResult, type RecentFile, type Settings, type SettingsChange } from '../shared/ipc'

export type ReadabilityApi = {
  openDialog(): Promise<FileReadResult | null>
  readFile(path: string): Promise<FileReadResult>
  watch(path: string): Promise<void>
  unwatch(): Promise<void>
  onFileChanged(cb: (path: string) => void): () => void
  onMenuOpen(cb: () => void): () => void
  onMenuReload(cb: () => void): () => void
  getSettings(): Promise<Settings>
  setSetting(key: keyof Settings, value: unknown): Promise<{ settings: Settings; change: SettingsChange | null }>
  resetSetting(key: keyof Settings): Promise<{ settings: Settings; change: SettingsChange | null }>
  getChangelog(): Promise<SettingsChange[]>
  getRecents(): Promise<RecentFile[]>
  clearRecents(): Promise<RecentFile[]>
  saveExport(defaultName: string, content: string): Promise<string | null>
}

function on(channel: string, cb: (arg: string) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, arg: string): void => cb(arg)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: ReadabilityApi = {
  openDialog: () => ipcRenderer.invoke(IPC.openDialog),
  readFile: (path) => ipcRenderer.invoke(IPC.readFile, path),
  watch: (path) => ipcRenderer.invoke(IPC.watch, path),
  unwatch: () => ipcRenderer.invoke(IPC.unwatch),
  onFileChanged: (cb) => on(IPC.fileChanged, cb),
  onMenuOpen: (cb) => on(IPC.menuOpen, () => cb()),
  onMenuReload: (cb) => on(IPC.menuReload, () => cb()),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  setSetting: (key, value) => ipcRenderer.invoke(IPC.setSetting, key, value),
  resetSetting: (key) => ipcRenderer.invoke(IPC.resetSetting, key),
  getChangelog: () => ipcRenderer.invoke(IPC.getChangelog),
  getRecents: () => ipcRenderer.invoke(IPC.getRecents),
  clearRecents: () => ipcRenderer.invoke(IPC.clearRecents),
  saveExport: (defaultName, content) => ipcRenderer.invoke(IPC.saveExport, defaultName, content)
}

contextBridge.exposeInMainWorld('rs', api)
