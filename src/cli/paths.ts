import { homedir } from 'node:os'
import { join } from 'node:path'
import { APP_ID } from '../shared/settings-schema'

/**
 * The folder Electron calls `userData`, worked out without Electron so the settings CLI finds the
 * same settings.json as the app. READABILITYSCOUT_DATA_DIR overrides it (the app honours it too).
 */
export function userDataDir(env: Record<string, string | undefined> = process.env, platform: string = process.platform): string {
  const override = env['READABILITYSCOUT_DATA_DIR']
  if (override) return override
  if (platform === 'darwin') return join(homedir(), 'Library', 'Application Support', APP_ID)
  if (platform === 'win32') return join(env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming'), APP_ID)
  return join(env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config'), APP_ID)
}
