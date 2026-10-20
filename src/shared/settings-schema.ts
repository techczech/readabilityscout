// The one settings schema (invariant 2) and the reader for the file the app wrote before
// shared settings (0.2.x: a flat userData/settings.json plus settings-changelog.json).
import { defineSchema, type Migrated } from '@bridle/settings'
import type { Settings } from './ipc'

export const APP_ID = 'readabilityscout'
export const APP_NAME = 'ReadabilityScout'

export const schema = defineSchema({
  app: APP_ID,
  sections: [
    { id: 'analysis', label: 'Analysis', icon: 'scan-text' },
    { id: 'annotations', label: 'Annotations', icon: 'highlighter' }
  ],
  settings: [
    {
      key: 'analysis.audience', label: 'Target audience', section: 'analysis', group: 'Audience', type: 'choice', default: 'general',
      options: [
        { value: 'broad', label: 'Broad public' },
        { value: 'general', label: 'General' },
        { value: 'academic', label: 'Academic' }
      ],
      help: 'Sets the targets behind the verdict and the suggestions.'
    },
    {
      key: 'analysis.longSentence', label: 'Long-sentence threshold', section: 'analysis', group: 'Thresholds', type: 'number',
      default: 25, min: 10, max: 60, unit: 'words',
      help: 'Sentences with more words than this are flagged.'
    },
    {
      key: 'analysis.readingWpm', label: 'Reading speed', section: 'analysis', group: 'Thresholds', type: 'number',
      default: 238, min: 100, max: 500, unit: 'wpm',
      help: 'Used for the reading-time estimate. 238 wpm is the adult non-fiction average (Brysbaert, 2019).'
    },
    {
      key: 'appearance.theme', label: 'Theme', section: 'appearance', type: 'choice', default: 'light',
      options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'system', label: 'System' }
      ],
      help: 'Light is the identity; dark is an option. System follows the Mac.'
    },
    {
      key: 'annotations.unfamiliar', label: 'Unfamiliar words', section: 'annotations', group: 'Marks in the text', type: 'toggle', default: true,
      help: 'Mark words outside the Dale–Chall familiar list.'
    },
    {
      key: 'annotations.academic', label: 'Academic words', section: 'annotations', group: 'Marks in the text', type: 'toggle', default: true,
      help: 'Mark Academic Word List words (Coxhead, 2000).'
    },
    {
      key: 'annotations.longSentences', label: 'Long sentences', section: 'annotations', group: 'Marks in the text', type: 'toggle', default: true,
      help: 'Mark sentences over the length threshold.'
    }
  ]
})

/** The renderer's flat names (what the components already use) to schema keys. */
export const KEY_OF: Readonly<Record<keyof Settings, string>> = {
  audience: 'analysis.audience',
  theme: 'appearance.theme',
  hlDiff: 'annotations.unfamiliar',
  hlAwl: 'annotations.academic',
  hlLong: 'annotations.longSentences',
  longSentence: 'analysis.longSentence',
  readingWpm: 'analysis.readingWpm'
}

export function flatKey(schemaKey: string): keyof Settings | null {
  for (const [flat, key] of Object.entries(KEY_OF)) if (key === schemaKey) return flat as keyof Settings
  return null
}

/** The renderer's view of the settings, from stored values (only non-defaults) over the schema defaults. */
export function toSettings(stored: Readonly<Record<string, unknown>>): Settings {
  const out: Record<string, unknown> = {}
  for (const [flat, key] of Object.entries(KEY_OF)) out[flat] = key in stored ? stored[key] : schema.def(key)?.default
  return out as Settings
}

/**
 * The 0.2.x file: `{ audience, theme, hlDiff, hlAwl, hlLong, longSentence, readingWpm }`, written whole on first run.
 * Returns null for anything that is not that shape, so the store treats it as damaged. Values that are not valid
 * are passed on as they are; the loader repairs them with an INVALID_SAVED_VALUE entry. Values equal to the default
 * produce no entry.
 */
export function migrateLegacy(old: unknown): Migrated | null {
  if (!old || typeof old !== 'object' || Array.isArray(old)) return null
  const rec = old as Record<string, unknown>
  if ('format' in rec) return null
  const settings: Record<string, unknown> = {}
  for (const [flat, key] of Object.entries(KEY_OF)) if (flat in rec) settings[key] = rec[flat]
  return Object.keys(settings).length > 0 ? { settings } : null
}

/** The legacy changelog beside it; replaced by the new one and deleted once the file is migrated. */
export const LEGACY_CHANGELOG_FILE = 'settings-changelog.json'
