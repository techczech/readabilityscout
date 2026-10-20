import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commandsAdapter, loadState } from '@bridle/settings'
import { SettingsStore } from '@bridle/settings/node'
import { run, appVersion } from '../cli/settings-cli'
import { registry } from './commands'
import { KEY_OF, LEGACY_CHANGELOG_FILE, migrateLegacy, schema, toSettings } from './settings-schema'

const VERSION = appVersion()
const commands = commandsAdapter(registry)
let n = 0
const load = (raw: unknown) => loadState(raw, { schema, appVersion: VERSION, now: () => 1_000, newId: () => `m${++n}`, commands, migrate: migrateLegacy })

// What 0.2.x wrote on first run and kept rewriting: every value, flat.
const LEGACY = { audience: 'academic', theme: 'dark', hlDiff: true, hlAwl: false, hlLong: true, longSentence: 30, readingWpm: 238 } as const

describe('schema', () => {
  test('covers every setting the 0.2.x app had, once each', () => {
    const keys = Object.values(KEY_OF)
    expect(new Set(keys).size).toBe(7)
    for (const k of keys) expect(schema.def(k)).toBeDefined()
    expect(schema.settings.length).toBe(7)
  })

  test('defaults equal the 0.2.x seed, so nothing shows as changed on a fresh install', () => {
    expect(toSettings({})).toEqual({ audience: 'general', theme: 'light', hlDiff: true, hlAwl: true, hlLong: true, longSentence: 25, readingWpm: 238 })
  })
})

describe('legacy migration', () => {
  test('a 0.2.x settings.json migrates to the right values, one app-update entry per changed value', () => {
    const r = load(LEGACY)
    expect(r.migrated).toBe(true)
    expect(r.problem).toBeUndefined()
    expect(r.state.settings).toEqual({ 'analysis.audience': 'academic', 'appearance.theme': 'dark', 'annotations.academic': false, 'analysis.longSentence': 30 })
    expect(r.entries.map((e) => e.key).sort()).toEqual(['analysis.audience', 'analysis.longSentence', 'annotations.academic', 'appearance.theme'])
    for (const e of r.entries) expect(e.who).toEqual({ kind: 'app-update', version: VERSION })
    expect(r.entries.find((e) => e.key === 'appearance.theme')).toMatchObject({ from: 'light', to: 'dark' })
    expect(toSettings(r.state.settings)).toEqual({ ...LEGACY })
  })

  test('the version on the entries is the 0.3 alpha being built', () => {
    expect(VERSION).toBe('0.3.0-alpha.1')
  })

  test('an untouched legacy file (all defaults) migrates with no entries', () => {
    const r = load({ audience: 'general', theme: 'light', hlDiff: true, hlAwl: true, hlLong: true, longSentence: 25, readingWpm: 238 })
    expect(r.migrated).toBe(true)
    expect(r.state.settings).toEqual({})
    expect(r.entries).toEqual([])
  })

  test('an invalid legacy value falls back to its default and is logged without the value', () => {
    const r = load({ ...LEGACY, theme: 'sepia', longSentence: 9999 })
    expect(r.state.settings['appearance.theme']).toBeUndefined()
    expect(r.state.settings['analysis.longSentence']).toBeUndefined()
    expect(r.entries.filter((e) => e.note === 'INVALID_SAVED_VALUE').length).toBe(2)
    expect(JSON.stringify(r.entries)).not.toContain('sepia')
  })

  test('something that is not a legacy file is treated as damaged', () => {
    expect(migrateLegacy([])).toBeNull()
    expect(migrateLegacy({ unrelated: 1 })).toBeNull()
    expect(load({ unrelated: 1 }).problem).toBe('not-settings')
  })
})

describe('store and CLI on a real folder', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rs-settings-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const cli = async (...argv: string[]) => {
    let out = ''
    let err = ''
    const code = await run(argv, { stdout: (t) => void (out += t), stderr: (t) => void (err += t), env: { BRIDLE_AGENT: 'Test agent' } }, dir)
    return { code, out, err }
  }

  test('opening the store migrates the legacy file in place; the old flat shape is gone', async () => {
    writeFileSync(join(dir, 'settings.json'), JSON.stringify(LEGACY))
    const store = new SettingsStore({ dir, app: schema.app, schema, registry: commands, appVersion: VERSION, migrate: migrateLegacy, log: () => {} })
    await store.ready
    const onDisk = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))
    expect(onDisk.format).toBe('bridle-settings')
    expect(onDisk.version).toBe(2)
    expect(onDisk.audience).toBeUndefined()
    expect(onDisk.settings['analysis.audience']).toBe('academic')
    expect(onDisk.changes.every((c: { who: { kind: string } }) => c.who.kind === 'app-update')).toBe(true)
    await store.close()
  })

  test('the store logs a window change as you and a reset as a reset entry', async () => {
    const store = new SettingsStore({ dir, app: schema.app, schema, registry: commands, appVersion: VERSION, migrate: migrateLegacy, log: () => {} })
    await store.ready
    const r = await store.set('annotations.unfamiliar', false)
    expect(r.ok && r.entries[0]).toMatchObject({ key: 'annotations.unfamiliar', from: true, to: false, who: { kind: 'you' } })
    const back = await store.reset('annotations.unfamiliar')
    expect(back.ok && back.entries.length).toBe(1)
    expect(store.view().settings).toEqual({})
    await store.close()
  })

  test('settings CLI: list, get, set, reset, changes, export, import, all with --json and who: agent', async () => {
    const list = await cli('list', '--json')
    expect(list.code).toBe(0)
    expect(JSON.parse(list.out).settings.map((s: { key: string }) => s.key).sort()).toEqual(Object.values(KEY_OF).sort())

    expect((await cli('set', 'appearance.theme', 'dark', '--json')).code).toBe(0)
    const got = await cli('get', 'appearance.theme', '--json')
    expect(JSON.parse(got.out)).toMatchObject({ value: 'dark', changed: true, lastChange: { who: { kind: 'agent', name: 'Test agent' } } })

    expect((await cli('set', 'analysis.longSentence', '99')).code).toBe(2) // out of range
    expect((await cli('set', 'nope.key', '1')).code).toBe(2)

    const changes = JSON.parse((await cli('changes', '--json')).out)
    expect(changes.total).toBe(1)

    const file = join(dir, 'export.json')
    expect((await cli('export', file)).code).toBe(0)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ format: 'bridle-settings-export', app: 'readabilityscout', settings: { 'appearance.theme': 'dark' } })

    expect((await cli('reset', '--all')).code).toBe(3) // one setting is changed: needs --yes
    expect((await cli('reset', 'appearance.theme')).code).toBe(0)
    const preview = await cli('import', file)
    expect(preview.code).toBe(3)
    expect((await cli('import', file, '--yes')).code).toBe(0)
    expect(JSON.parse((await cli('get', 'appearance.theme', '--json')).out).value).toBe('dark')
    expect((await cli('undo-import', '--last')).code).toBe(0)
    expect(JSON.parse((await cli('get', 'appearance.theme', '--json')).out).value).toBe('light')
  })

  test('the CLI migrates a legacy file it meets first, and the legacy changelog is not touched by it', async () => {
    writeFileSync(join(dir, 'settings.json'), JSON.stringify(LEGACY))
    writeFileSync(join(dir, LEGACY_CHANGELOG_FILE), '[]')
    const r = await cli('get', 'analysis.audience', '--json')
    expect(JSON.parse(r.out).value).toBe('academic')
    expect(existsSync(join(dir, LEGACY_CHANGELOG_FILE))).toBe(true) // the app removes it at start-up (settings-host.ts)
  })

  test('a damaged settings file is set aside and defaults load', async () => {
    writeFileSync(join(dir, 'settings.json'), '{ not json')
    const r = await cli('get', 'appearance.theme', '--json')
    expect(JSON.parse(r.out).value).toBe('light')
  })
})
