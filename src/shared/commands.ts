// The one command registry (invariant 1). The menu bar, the ? cheat sheet, the Shortcuts page
// of the Settings window and the key handler all read this list; nothing else names a chord.
// Pure: no Electron, no React, so main, renderer, CLI and tests share it.
import { chordFromEvent, defineRegistry, dispatchKey, type Bindings, type CommandDef, type KeyContext, type KeyLike, type MenuDecl } from '@bridle/commands'

export type Group = 'File' | 'Samples' | 'Text' | 'Report' | 'Annotations' | 'Navigation'

/** What `available` looks at. The renderer owns it and tells main so the menu can grey items out. */
export type CommandContext = { hasFile: boolean; hasAnalysis: boolean }
export const NO_CONTEXT: CommandContext = { hasFile: false, hasAnalysis: false }

const needsAnalysis = (what: string) => (c: CommandContext): string | null => (c.hasAnalysis ? null : what)

const DEFS: CommandDef<Group, CommandContext>[] = [
  { id: 'open', group: 'File', label: 'Open a text file…', key: '⌘O', icon: 'folder-open', typing: true },
  { id: 'recent-files', group: 'File', label: 'Recent files', key: '', icon: 'history' },
  { id: 'clear-recents', group: 'File', label: 'Clear recent files', key: '', icon: 'trash-2' },
  {
    id: 'reload', group: 'File', label: 'Reload from disk', key: '⌘⇧R', icon: 'refresh-cw', typing: true,
    available: (c) => (c.hasFile ? null : 'Open a file first')
  },
  { id: 'sample-1', group: 'Samples', label: 'Load sample 1', key: '1', icon: 'file-text' },
  { id: 'sample-2', group: 'Samples', label: 'Load sample 2', key: '2', icon: 'file-text' },
  { id: 'sample-3', group: 'Samples', label: 'Load sample 3', key: '3', icon: 'file-text' },
  { id: 'sample-4', group: 'Samples', label: 'Load sample 4', key: '4', icon: 'file-text' },
  { id: 'focus-editor', group: 'Text', label: 'Focus the text field', key: 'E', icon: 'text-cursor-input' },
  { id: 'clear-text', group: 'Text', label: 'Clear the text', key: 'X', icon: 'eraser' },
  {
    id: 'copy-report', group: 'Report', label: 'Copy the Markdown report', key: 'R', icon: 'copy',
    available: needsAnalysis('Nothing to report on yet')
  },
  {
    id: 'save-json', group: 'Report', label: 'Save the analysis as JSON…', key: 'J', icon: 'download',
    available: needsAnalysis('Nothing to export yet')
  },
  { id: 'toggle-diff', group: 'Annotations', label: 'Mark unfamiliar words', key: 'D', icon: 'highlighter' },
  { id: 'toggle-awl', group: 'Annotations', label: 'Mark academic words', key: 'A', icon: 'graduation-cap' },
  { id: 'toggle-long', group: 'Annotations', label: 'Mark long sentences', key: 'L', icon: 'ruler' },
  {
    id: 'dismiss', group: 'Navigation', label: 'Close overlays / leave the text field', key: 'Esc', icon: 'x',
    typing: true, noMenu: true, noMenuReason: 'Escape is a movement key, not a menu action'
  }
]

// The frame commands (settings, cheat, export-settings, import-settings) are added by the package.
export const registry = defineRegistry<Group, CommandContext>(DEFS, {
  overlayIds: ['dismiss', 'settings', 'cheat']
})

export type CommandId = (typeof DEFS)[number]['id'] | 'settings' | 'cheat' | 'export-settings' | 'import-settings'

/** App menus; the frame supplies App, Edit, View, Window and Help. */
export const MENUS: MenuDecl<Group>[] = [
  { label: 'File', groups: ['File', 'Report'] },
  { label: 'Text', groups: ['Text', 'Samples'] },
  { label: 'View', groups: ['Annotations'] }
]

/**
 * Keys that also run a command although the registry binds a different chord: the two single-key
 * habits from before the registry (? for the cheat sheet, S for Settings). The registry keeps ⌘/ and
 * ⌘, as fixed estate chords, so these cannot be rebound. Chord (as `chordFromEvent` writes it) to
 * the command and the text the cheat sheet shows.
 */
export const KEY_ALIASES: Readonly<Record<string, { id: CommandId; show: string }>> = {
  '⇧/': { id: 'cheat', show: '?' },
  S: { id: 'settings', show: 'S' }
}

/** Alias keys for one command, as the cheat sheet shows them. */
export function aliasesOf(id: string): string[] {
  return Object.values(KEY_ALIASES).flatMap((a) => (a.id === id ? [a.show] : []))
}

/** The command a key press runs: the registry's binding, else an alias (outside text fields and overlays). */
export function commandForEvent(e: KeyLike & { key?: string }, bindings: Bindings, ctx: KeyContext): string | null {
  const id = dispatchKey(registry, e, bindings, ctx)
  if (id || ctx.inField || ctx.overlay) return id
  // "?" is the character typed, wherever the layout puts it; the other aliases go by physical key.
  const chord = e.key === '?' ? '⇧/' : chordFromEvent(e)
  return (chord && KEY_ALIASES[chord]?.id) || null
}

/** Commands the main process runs itself (the Settings window host); the rest go to the renderer. */
export const MAIN_COMMANDS: ReadonlySet<string> = new Set(['settings', 'export-settings', 'import-settings'])

/** A tooltip with the command's effective chord: "Open a text file (⌘O)". Nothing hand-copies a chord. */
export function withChord(bindings: Readonly<Record<string, string>>, id: CommandId, text: string): string {
  const chord = bindings[id]
  return chord ? `${text} (${chord})` : text
}
