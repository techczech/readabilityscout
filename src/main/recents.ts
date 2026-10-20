import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RecentFile } from '../shared/ipc'

// Recent files are history, not a preference, so they stay outside the settings schema.

function file(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'recent-files.json')
}

export function loadRecents(): RecentFile[] {
  const path = file()
  if (!existsSync(path)) return []
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as RecentFile[]
  } catch {
    return []
  }
}

function save(recents: RecentFile[]): void {
  writeFileSync(file(), JSON.stringify(recents, null, 2))
}

export function addRecent(path: string, name: string): RecentFile[] {
  const entry: RecentFile = { path, name, openedAt: new Date().toISOString() }
  const next = [entry, ...loadRecents().filter((r) => r.path !== path)].slice(0, 12)
  save(next)
  return next
}

export function clearRecents(): RecentFile[] {
  save([])
  return []
}
