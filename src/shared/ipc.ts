// Shared types and channel names for main <-> renderer IPC.
// The app never writes to user files (ADR 0002); the only disk writes are
// the settings file and recents in userData and explicit exports via a save dialog.

export type Settings = {
  audience: 'broad' | 'general' | 'academic'
  theme: 'light' | 'dark' | 'system'
  hlDiff: boolean
  hlAwl: boolean
  hlLong: boolean
  longSentence: number
  readingWpm: number
}

/** What the main window needs of the settings store: values with defaults filled in, and the effective chord of every command. */
export type SettingsSnapshot = {
  settings: Settings
  bindings: Record<string, string>
}

export type RecentFile = {
  path: string
  name: string
  openedAt: string // ISO timestamp
}

export type OpenedFile = {
  ok: true
  path: string
  name: string
  content: string
  /** Set when the content was extracted from a binary format rather than read as plain text. */
  extracted: 'pdf' | 'docx' | null
  truncated: boolean
}

export type FileError = {
  ok: false
  path: string
  name: string
  reason: string // human-readable, safe to show in the UI
}

export type FileReadResult = OpenedFile | FileError

export const IPC = {
  openDialog: 'rs:open-dialog',
  readFile: 'rs:read-file',
  watch: 'rs:watch',
  unwatch: 'rs:unwatch',
  fileChanged: 'rs:file-changed',
  getSettings: 'rs:get-settings',
  setSetting: 'rs:set-setting',
  settingsChanged: 'rs:settings-changed',
  runCommand: 'rs:run-command',
  command: 'rs:command',
  setContext: 'rs:set-context',
  getRecents: 'rs:get-recents',
  clearRecents: 'rs:clear-recents',
  saveExport: 'rs:save-export'
} as const
