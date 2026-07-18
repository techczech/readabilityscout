import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RecentFile, Settings, SettingsChange } from '../shared/ipc'

// Seeded once on first run; every value is visible and editable in Settings, and
// every later change lands in the changelog with a Reset path.
export const SEED: Settings = {
  audience: 'general',
  theme: 'light',
  hlDiff: true,
  hlAwl: true,
  hlLong: true,
  longSentence: 25,
  readingWpm: 238
}

function dataDir(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function readJson<T>(file: string, fallback: T): T {
  const path = join(dataDir(), file)
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(join(dataDir(), file), JSON.stringify(value, null, 2))
}

export function loadSettings(): Settings {
  const stored = readJson<Partial<Settings>>('settings.json', {})
  if (!existsSync(join(dataDir(), 'settings.json'))) writeJson('settings.json', SEED)
  return { ...SEED, ...stored }
}

export function loadChangelog(): SettingsChange[] {
  return readJson<SettingsChange[]>('settings-changelog.json', [])
}

export function setSetting(key: keyof Settings, value: unknown): { settings: Settings; change: SettingsChange | null } {
  const current = loadSettings()
  const oldValue = current[key]
  if (oldValue === value) return { settings: current, change: null }
  const next = { ...current, [key]: value } as Settings
  writeJson('settings.json', next)
  const change: SettingsChange = { key, oldValue, newValue: value, at: new Date().toISOString() }
  const log = [change, ...loadChangelog()].slice(0, 60)
  writeJson('settings-changelog.json', log)
  return { settings: next, change }
}

export function resetSetting(key: keyof Settings): { settings: Settings; change: SettingsChange | null } {
  return setSetting(key, SEED[key])
}

export function loadRecents(): RecentFile[] {
  return readJson<RecentFile[]>('recent-files.json', [])
}

export function addRecent(path: string, name: string): RecentFile[] {
  const entry: RecentFile = { path, name, openedAt: new Date().toISOString() }
  const next = [entry, ...loadRecents().filter((r) => r.path !== path)].slice(0, 12)
  writeJson('recent-files.json', next)
  return next
}

export function clearRecents(): RecentFile[] {
  writeJson('recent-files.json', [])
  return []
}
