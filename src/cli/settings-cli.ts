// `readabilityscout settings <list|get|set|reset|changes|export|import|undo-import> [--json]`
// The agent path to the same settings file and changelog the Settings window uses.
// Run with bun (`bin/readabilityscout.mjs`, `bun run settings -- list`); needs no Electron.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { commandsAdapter } from '@bridle/settings'
import { runSettingsCli, type SettingsCliIO } from '@bridle/settings/node'
import { registry } from '../shared/commands'
import { userDataDir } from './paths'
import { APP_ID, APP_NAME, migrateLegacy, schema } from '../shared/settings-schema'

export function appVersion(): string {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8')) as { version: string }
  return pkg.version
}

const processIO = { stdout: (t: string): void => void process.stdout.write(t), stderr: (t: string): void => void process.stderr.write(t) }

/** `dir` and `io` are injectable for tests; by default the real userData folder and the terminal. */
export function run(argv: string[], io: SettingsCliIO = processIO, dir: string = userDataDir()): Promise<number> {
  return runSettingsCli(
    argv,
    {
      app: APP_ID,
      appName: APP_NAME,
      dir,
      schema,
      registry: commandsAdapter(registry),
      version: appVersion(),
      migrate: migrateLegacy
    },
    io
  )
}

if (import.meta.main) process.exit(await run(process.argv.slice(2)))
