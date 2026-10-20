import { describe, expect, test } from 'bun:test'
import { buildMenuTemplate, validateMenuCoverage, type KeyLike } from '@bridle/commands'
import { KEY_ALIASES, MENUS, NO_CONTEXT, aliasesOf, commandForEvent, registry, withChord } from './commands'

const key = (code: string, mods: Partial<Pick<KeyLike, 'metaKey' | 'shiftKey' | 'ctrlKey' | 'altKey'>> = {}): KeyLike => ({
  code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods
})
const bindings = registry.bindingsOf({})
const ctx = { inField: false, onControl: false, overlay: false }

type Item = { label?: string; submenu?: Item[]; enabled?: boolean; accelerator?: string; click?: () => void }
const labelsOf = (items: Item[]): string[] => items.flatMap((i) => (i.submenu ? labelsOf(i.submenu) : i.label ? [i.label] : []))

describe('command registry', () => {
  test('every non-noMenu command is in exactly one menu (validateMenuCoverage returns nothing)', () => {
    expect(validateMenuCoverage(registry, MENUS)).toEqual([])
  })

  test('the generated menu lists every menu command once, with its effective chord', () => {
    const template = buildMenuTemplate({ appName: 'ReadabilityScout', registry, menus: MENUS, bindings, run: () => {}, ctx: NO_CONTEXT }) as Item[]
    const all = labelsOf(template)
    for (const def of registry.defs.filter((d) => !d.noMenu)) {
      expect(all.filter((l) => l === def.label).length).toBe(1)
    }
    expect(all).not.toContain(registry.byId('dismiss')!.label)
    const file = template.find((m) => m.label === 'File')!.submenu!
    expect(file.find((i) => i.label === 'Open a text file…')!.accelerator).toBe('Cmd+O')
    // Settings… ⌘, and the export/import pair sit in the App menu.
    const app = template[0]!.submenu!
    expect(app.find((i) => i.label === 'Settings…')!.accelerator).toBe('Cmd+,')
    expect(app.map((i) => i.label)).toEqual(expect.arrayContaining(['Export Settings…', 'Import Settings…']))
  })

  test('commands that need a file or an analysis are disabled until there is one', () => {
    const build = (c: typeof NO_CONTEXT) =>
      (buildMenuTemplate({ appName: 'x', registry, menus: MENUS, bindings, run: () => {}, ctx: c }) as Item[])
        .find((m) => m.label === 'File')!.submenu!
    const off = build(NO_CONTEXT)
    expect(off.find((i) => i.label === 'Reload from disk')!.enabled).toBe(false)
    expect(off.find((i) => i.label === 'Copy the Markdown report')!.enabled).toBe(false)
    const on = build({ hasFile: true, hasAnalysis: true })
    expect(on.find((i) => i.label === 'Reload from disk')!.enabled).toBeUndefined()
    expect(on.find((i) => i.label === 'Copy the Markdown report')!.enabled).toBeUndefined()
  })

  test('the shortcuts the app had before the registry still work', () => {
    const chordCmd = (code: string, mods = {}, c = ctx) => commandForEvent(key(code, mods), bindings, c)
    expect(chordCmd('KeyO', { metaKey: true })).toBe('open')
    expect(chordCmd('KeyR', { metaKey: true, shiftKey: true })).toBe('reload')
    expect(chordCmd('KeyS')).toBe('settings') // alias
    expect(chordCmd('Slash', { shiftKey: true })).toBe('cheat') // "?"
    expect(commandForEvent({ ...key('Minus', { shiftKey: true }), key: '?' }, bindings, ctx)).toBe('cheat') // "?" on another layout
    expect(chordCmd('Comma', { metaKey: true })).toBe('settings')
    expect(chordCmd('Slash', { metaKey: true })).toBe('cheat')
    for (const [code, id] of [['KeyE', 'focus-editor'], ['KeyX', 'clear-text'], ['KeyR', 'copy-report'], ['KeyJ', 'save-json'], ['KeyD', 'toggle-diff'], ['KeyA', 'toggle-awl'], ['KeyL', 'toggle-long'], ['Digit1', 'sample-1'], ['Digit4', 'sample-4'], ['Escape', 'dismiss']] as const) {
      expect(chordCmd(code)).toBe(id)
    }
  })

  test('inside a text field only the typing commands run', () => {
    const inField = { ...ctx, inField: true }
    expect(commandForEvent(key('KeyE'), bindings, inField)).toBeNull()
    expect(commandForEvent(key('KeyS'), bindings, inField)).toBeNull()
    expect(commandForEvent(key('KeyO', { metaKey: true }), bindings, inField)).toBe('open')
    expect(commandForEvent(key('Escape'), bindings, inField)).toBe('dismiss')
  })

  test('with the cheat sheet open only overlay commands run', () => {
    const overlay = { ...ctx, overlay: true }
    expect(commandForEvent(key('KeyD'), bindings, overlay)).toBeNull()
    expect(commandForEvent(key('KeyS'), bindings, overlay)).toBeNull()
    expect(commandForEvent(key('Escape'), bindings, overlay)).toBe('dismiss')
  })

  test('a rebound shortcut moves the command and frees the old chord', () => {
    const b = registry.bindingsOf({ 'toggle-diff': '⌘⌥D' })
    expect(commandForEvent(key('KeyD', { metaKey: true, altKey: true }), b, ctx)).toBe('toggle-diff')
    expect(commandForEvent(key('KeyD'), b, ctx)).toBeNull()
  })

  test('chords are shown from the bindings, aliases listed beside their command', () => {
    expect(withChord(bindings, 'open', 'Open')).toBe('Open (⌘O)')
    expect(withChord(registry.bindingsOf({ open: '' }), 'open', 'Open')).toBe('Open')
    expect(aliasesOf('cheat')).toEqual(['?'])
    expect(aliasesOf('settings')).toEqual(['S'])
    for (const a of Object.values(KEY_ALIASES)) expect(registry.byId(a.id)).toBeDefined()
  })

  test('the cheat sheet lists every command that has a chord', () => {
    const listed = registry.cheatSheet(bindings).flatMap((g) => g.entries.map((e) => e.id))
    for (const d of registry.defs.filter((x) => x.key)) expect(listed).toContain(d.id)
  })
})
