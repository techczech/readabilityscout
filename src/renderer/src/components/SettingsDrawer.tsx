import React, { useEffect, useRef, useState } from 'react'
import { Monitor, Moon, RotateCcw, Search, Settings as SettingsIcon, Sun, X } from 'lucide-react'
import type { Settings, SettingsChange } from '../../../shared/ipc'

type Def =
  | { kind: 'seg'; key: 'audience' | 'theme'; label: string; desc: string; options: Array<[string, string, React.ReactNode?]> }
  | { kind: 'switch'; key: 'hlDiff' | 'hlAwl' | 'hlLong'; label: string; desc: string }
  | { kind: 'number'; key: 'longSentence' | 'readingWpm'; label: string; desc: string; min: number; max: number }

const GROUPS: Array<{ group: string; items: Def[] }> = [
  {
    group: 'Audience',
    items: [
      { kind: 'seg', key: 'audience', label: 'Target audience', desc: 'Sets the targets behind the verdict and the suggestions.',
        options: [['broad', 'Broad public'], ['general', 'General'], ['academic', 'Academic']] }
    ]
  },
  {
    group: 'Appearance',
    items: [
      { kind: 'seg', key: 'theme', label: 'Theme', desc: 'Light is the identity; dark is an option.',
        options: [['light', 'Light', <Sun key="s" size={13} />], ['dark', 'Dark', <Moon key="m" size={13} />], ['system', 'System', <Monitor key="y" size={13} />]] }
    ]
  },
  {
    group: 'Annotations',
    items: [
      { kind: 'switch', key: 'hlDiff', label: 'Unfamiliar words', desc: 'Mark words outside the Dale–Chall familiar list.' },
      { kind: 'switch', key: 'hlAwl', label: 'Academic words', desc: 'Mark Academic Word List words (Coxhead, 2000).' },
      { kind: 'switch', key: 'hlLong', label: 'Long sentences', desc: 'Mark sentences over the length threshold.' }
    ]
  },
  {
    group: 'Analysis',
    items: [
      { kind: 'number', key: 'longSentence', label: 'Long-sentence threshold', desc: 'Sentences with more words than this are flagged.', min: 10, max: 60 },
      { kind: 'number', key: 'readingWpm', label: 'Reading speed (wpm)', desc: 'Used for the reading-time estimate. 238 wpm is the adult non-fiction average (Brysbaert, 2019).', min: 100, max: 500 }
    ]
  }
]

const LABELS: Record<string, string> = Object.fromEntries(GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])))

function displayValue(key: keyof Settings, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off'
  const def = GROUPS.flatMap((g) => g.items).find((i) => i.key === key)
  if (def?.kind === 'seg') return def.options.find((o) => o[0] === value)?.[1] ?? String(value)
  return String(value)
}

type Props = {
  open: boolean
  settings: Settings
  changelog: SettingsChange[]
  onClose: () => void
  onSet: (key: keyof Settings, value: unknown) => void
  onReset: (key: keyof Settings) => void
}

export default function SettingsDrawer(props: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (props.open) searchRef.current?.focus()
  }, [props.open])

  const q = query.toLowerCase()
  const visible = (d: Def, group: string): boolean =>
    !q || `${d.label} ${d.desc} ${group}`.toLowerCase().includes(q)

  return (
    <aside className={'drawer' + (props.open ? ' show' : '')} aria-label="Settings" role="dialog" aria-modal="true">
      <div className="drawer-head">
        <SettingsIcon className="icon" />
        <h2>Settings</h2>
        <div style={{ flex: 1 }} />
        <button className="btn icon-only" onClick={props.onClose} aria-label="Close settings">
          <X className="icon" />
        </button>
      </div>
      <div className="drawer-body">
        <div className="search-box" style={{ marginBottom: 13 }}>
          <Search className="icon" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search settings…"
            aria-label="Search settings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {GROUPS.map((g) => {
          const items = g.items.filter((d) => visible(d, g.group))
          if (!items.length) return null
          return (
            <div className="set-group" key={g.group}>
              <h3>{g.group}</h3>
              {items.map((d) => (
                <div className="set-row" key={d.key}>
                  <div className="set-label">
                    <span>{d.label}</span>
                    {d.kind === 'switch' && (
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={props.settings[d.key] as boolean}
                          aria-label={d.label}
                          onChange={(e) => props.onSet(d.key, e.target.checked)}
                        />
                        <span className="track" />
                      </label>
                    )}
                    {d.kind === 'number' && (
                      <input
                        className="num-input"
                        type="number"
                        min={d.min}
                        max={d.max}
                        defaultValue={props.settings[d.key] as number}
                        aria-label={d.label}
                        onChange={(e) => {
                          let v = Math.round(+e.target.value)
                          if (!isFinite(v)) return
                          v = Math.max(d.min, Math.min(d.max, v))
                          props.onSet(d.key, v)
                        }}
                      />
                    )}
                  </div>
                  {d.kind === 'seg' && (
                    <div className="seg" role="group" aria-label={d.label}>
                      {d.options.map(([value, label, ic]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={props.settings[d.key] === value}
                          onClick={() => props.onSet(d.key, value)}
                        >
                          {ic}
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="set-desc">{d.desc}</div>
                </div>
              ))}
            </div>
          )
        })}
        <div className="set-group changelog">
          <h3>Settings changelog</h3>
          {props.changelog.length === 0 && (
            <div className="log-empty">No changes yet. Every settings change is recorded here with a one-click reset.</div>
          )}
          {props.changelog.map((entry, i) => {
            const when = new Date(entry.at)
            return (
              <div className="log-row" key={`${entry.at}-${i}`}>
                <div className="log-what">
                  <b>{LABELS[entry.key] ?? entry.key}</b>
                  <span className="log-change">
                    {displayValue(entry.key, entry.oldValue)} → {displayValue(entry.key, entry.newValue)}
                  </span>
                  <span className="log-when">
                    {when.toLocaleDateString('en-GB')} {when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button className="log-reset" onClick={() => props.onReset(entry.key)} title="Reset to the seeded default">
                  <RotateCcw className="icon" size={12} />
                  Reset
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
