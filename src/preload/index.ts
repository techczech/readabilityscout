import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type FileReadResult, type RecentFile, type Settings, type SettingsSnapshot } from '../shared/ipc'
import type { CommandContext } from '../shared/commands'

export type ReadabilityApi = {
  openDialog(): Promise<FileReadResult | null>
  readFile(path: string): Promise<FileReadResult>
  watch(path: string): Promise<void>
  unwatch(): Promise<void>
  onFileChanged(cb: (path: string) => void): () => void
  /** A command chosen in the menu bar (the renderer runs it). */
  onCommand(cb: (id: string) => void): () => void
  /** Commands the main process runs itself: settings, export-settings, import-settings. */
  runCommand(id: string): Promise<void>
  /** Tells main what the menu needs to grey commands out. */
  setContext(ctx: CommandContext): Promise<void>
  getSettings(): Promise<SettingsSnapshot>
  setSetting(key: keyof Settings, value: unknown): Promise<void>
  /** Fires after any change: this window, the Settings window, the settings CLI, an import. */
  onSettingsChanged(cb: (snapshot: SettingsSnapshot) => void): () => void
  getRecents(): Promise<RecentFile[]>
  clearRecents(): Promise<RecentFile[]>
  saveExport(defaultName: string, content: string): Promise<string | null>
}

function on<T>(channel: string, cb: (arg: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, arg: T): void => cb(arg)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: ReadabilityApi = {
  openDialog: () => ipcRenderer.invoke(IPC.openDialog),
  readFile: (path) => ipcRenderer.invoke(IPC.readFile, path),
  watch: (path) => ipcRenderer.invoke(IPC.watch, path),
  unwatch: () => ipcRenderer.invoke(IPC.unwatch),
  onFileChanged: (cb) => on<string>(IPC.fileChanged, cb),
  onCommand: (cb) => on<string>(IPC.command, cb),
  runCommand: (id) => ipcRenderer.invoke(IPC.runCommand, id),
  setContext: (ctx) => ipcRenderer.invoke(IPC.setContext, ctx),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  setSetting: (key, value) => ipcRenderer.invoke(IPC.setSetting, key, value),
  onSettingsChanged: (cb) => on<SettingsSnapshot>(IPC.settingsChanged, cb),
  getRecents: () => ipcRenderer.invoke(IPC.getRecents),
  clearRecents: () => ipcRenderer.invoke(IPC.clearRecents),
  saveExport: (defaultName, content) => ipcRenderer.invoke(IPC.saveExport, defaultName, content)
}

contextBridge.exposeInMainWorld('rs', api)
