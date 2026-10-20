// The app's side of the shared settings: the store (userData/settings.json, v2), the Settings
// window, the generated menu bar and export/import. Everything with behaviour is in the
// @bridle packages; this file only wires them to this app's schema, registry and windows.
import { app } from 'electron'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { commandsAdapter } from '@bridle/settings'
import { SettingsStore } from '@bridle/settings/node'
import { installSettings, type SettingsHost } from '@bridle/settings-electron/main'
import { is } from '@electron-toolkit/utils'
import { MAIN_COMMANDS, MENUS, NO_CONTEXT, registry, type CommandContext } from '../shared/commands'
import type { Settings, SettingsSnapshot } from '../shared/ipc'
import { APP_ID, KEY_OF, LEGACY_CHANGELOG_FILE, migrateLegacy, schema, toSettings } from '../shared/settings-schema'

export type SettingsApp = {
  snapshot(): SettingsSnapshot
  setValue(key: keyof Settings, value: unknown): Promise<void>
  runMainCommand(id: string): void
  setContext(ctx: CommandContext): void
  dispose(): void
}

type Wiring = {
  /** Show the main window (create it if it was closed). */
  openMain(): void
  /** Run a command in the main window's renderer. */
  sendCommand(id: string): void
  /** The settings changed (from anywhere): tell the main window. */
  changed(snapshot: SettingsSnapshot): void
}

function settingsPageUrl(): string {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) return `${process.env['ELECTRON_RENDERER_URL']}/settings.html`
  return pathToFileURL(join(__dirname, '../renderer/settings.html')).href
}

export async function startSettings(wiring: Wiring): Promise<SettingsApp> {
  const dir = app.getPath('userData')
  let host: SettingsHost | undefined
  let ctx: CommandContext = NO_CONTEXT

  const snapshotOf = (state: { settings: Record<string, unknown>; keys: Record<string, string> }): SettingsSnapshot => ({
    settings: toSettings(state.settings),
    bindings: registry.bindingsOf(state.keys)
  })

  const store = new SettingsStore({
    dir,
    app: APP_ID,
    schema,
    registry: commandsAdapter(registry),
    appVersion: app.getVersion(),
    migrate: migrateLegacy,
    onChange: (state) => {
      host?.storeChanged(state)
      wiring.changed(snapshotOf(state))
    }
  })
  await store.ready

  // The 0.2.x changelog is replaced by the store's own once settings.json has been migrated.
  const legacyLog = join(dir, LEGACY_CHANGELOG_FILE)
  if (existsSync(legacyLog) && store.problem() === undefined) {
    try {
      unlinkSync(legacyLog)
    } catch {
      /* left in place; nothing reads it */
    }
  }

  host = installSettings({
    store,
    schema,
    registry,
    menus: MENUS,
    openMain: wiring.openMain,
    sendCommand: wiring.sendCommand,
    menuContext: () => ctx,
    window: { preload: join(__dirname, '../preload/settings.js'), url: settingsPageUrl() },
    appInfo: { icon: 'scan-text', cli: APP_ID }
  })

  return {
    snapshot: () => snapshotOf(store.view()),
    async setValue(key, value) {
      const schemaKey = KEY_OF[key]
      if (!schemaKey) throw new Error(`Unknown setting ${String(key)}`)
      const r = await store.set(schemaKey, value as never)
      if (!r.ok) throw new Error(r.error)
    },
    runMainCommand(id) {
      if (!MAIN_COMMANDS.has(id)) return
      if (id === 'export-settings') void host?.exportSettings()
      else if (id === 'import-settings') host?.startImport()
      else host?.openSettingsWindow()
    },
    setContext(next) {
      if (next.hasFile === ctx.hasFile && next.hasAnalysis === ctx.hasAnalysis) return
      ctx = next
      host?.rebuildMenu()
    },
    dispose() {
      host?.dispose()
      void store.close()
    }
  }
}
