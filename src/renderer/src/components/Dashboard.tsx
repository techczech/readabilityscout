import React, { useMemo, useState } from 'react'
import {
  AlignLeft, BookOpen, Check, ChevronDown, FileText, Gauge, Lightbulb, Pilcrow, Ruler, Search
} from 'lucide-react'
import type { Settings } from '../../../shared/ipc'
import type { Analysis, SentenceDetail } from '../analysis/engine'
import { fmtTime, splitHint, suggestionsFor, type Audience } from '../analysis/insights'

const MIN_WORDS = 30

/* ---------- shared bits ---------- */

export function gradeBand(g: number): 'easy' | 'moderate' | 'hard' | 'veryhard' {
  return g <= 6 ? 'easy' : g <= 9 ? 'moderate' : g <= 12 ? 'hard' : 'veryhard'
}

function fleschBand(f: number): ['easy' | 'moderate' | 'hard' | 'veryhard', string] {
  if (f >= 80) return ['easy', 'Easy']
  if (f >= 70) return ['easy', 'Fairly easy']
  if (f >= 60) return ['moderate', 'Standard']
  if (f >= 50) return ['hard', 'Fairly hard']
  if (f >= 30) return ['veryhard', 'Hard']
  return ['veryhard', 'Very hard']
}

const fmt = (n: number, dp = 1): string => n.toFixed(dp)

function polar(cx: number, cy: number, rad: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 180) * Math.PI) / 180
  return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]
}

function arcPath(cx: number, cy: number, rad: number, fromDeg: number, toDeg: number): string {
  const p1 = polar(cx, cy, rad, fromDeg)
  const p2 = polar(cx, cy, rad, toDeg)
  const large = toDeg - fromDeg > 180 ? 1 : 0
  return `M ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} A ${rad} ${rad} 0 ${large} 1 ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
}

/* ---------- cards ---------- */

function ScoreCard({ r, aud }: { r: Analysis; aud: Audience }): React.JSX.Element {
  const f = Math.max(0, Math.min(100, r.scores.flesch))
  const [band, bandLabel] = fleschBand(r.scores.flesch)
  const sweep = (f / 100) * 180
  const checks = [
    r.scores.daleChall.adjusted <= aud.dcMax,
    r.averages.sentenceLength <= aud.aslMax,
    r.difficult.pct <= aud.diffPctMax
  ]
  const passed = checks.filter(Boolean).length
  const verdict =
    passed === 3
      ? (['ok', `Well matched to ${aud.label.toLowerCase()}.`] as const)
      : passed === 2
        ? (['warn', 'Mostly there — see the suggestions below.'] as const)
        : (['bad', `Too dense for ${aud.label.toLowerCase()} — see below.`] as const)
  return (
    <div className="card">
      <h2><Gauge className="icon" />Overall</h2>
      <div className="score-hero">
        <div className="gauge-wrap">
          <svg viewBox="0 0 148 86">
            <path d={arcPath(74, 76, 58, 0, 180)} stroke="var(--line-strong)" strokeWidth={11} fill="none" strokeLinecap="round" />
            <path d={arcPath(74, 76, 58, 0, Math.max(1.5, sweep))} stroke={`var(--${band})`} strokeWidth={11} fill="none" strokeLinecap="round" />
            <text x={12} y={85} fontSize={8} fill="var(--ink-3)" fontFamily="var(--mono)">0</text>
            <text x={126} y={85} fontSize={8} fill="var(--ink-3)" fontFamily="var(--mono)">100</text>
          </svg>
          <div className="gauge-centre">
            <div className="big num">{Math.round(r.scores.flesch)}</div>
            <div className="cap">Flesch · {bandLabel}</div>
          </div>
        </div>
        <div className="score-facts">
          <div className="fact"><span>Dale–Chall grade</span><b>{fmt(r.scores.daleChall.adjusted)} · {r.scores.daleChall.label}</b></div>
          <div className="fact"><span>Grade consensus</span><b>{fmt(r.consensus.median)}</b></div>
          <div className="fact"><span>Reading time</span><b>{fmtTime(r.time.readingMin)}</b></div>
          <div className="fact"><span>Speaking time</span><b>{fmtTime(r.time.speakingMin)}</b></div>
        </div>
      </div>
      <div className={`verdict ${verdict[0]}`}>
        {passed === 3 ? <Check className="icon" size={14} /> : <Lightbulb className="icon" size={14} />}
        {verdict[1]}
      </div>
    </div>
  )
}

function ConsensusCard({ r }: { r: Analysis }): React.JSX.Element {
  const W = 340, H = 78, X0 = 14, X1 = 326, AXIS_Y = 46
  const gx = (g: number): number => X0 + ((g - 1) / 16) * (X1 - X0)
  const bands: Array<[number, number, string]> = [
    [1, 7, 'easy'], [7, 10, 'moderate'], [10, 13, 'hard'], [13, 17, 'veryhard']
  ]
  // Two staggered label rows, nudged apart when crowded (demo ADR 0001).
  const sorted = [...r.consensus.marks].sort((a, b) => a.grade - b.grade)
  const labelRows: Array<typeof sorted> = [[], []]
  sorted.forEach((mk, i) => labelRows[i % 2].push(mk))
  const lx = new Map<string, number>()
  labelRows.forEach((row) => {
    let x = -Infinity
    row.forEach((mk) => {
      x = Math.max(gx(mk.grade), x + 26)
      lx.set(mk.id, x)
    })
    const over = x - (W - 14)
    if (over > 0) row.forEach((mk) => lx.set(mk.id, (lx.get(mk.id) ?? 0) - over))
  })
  return (
    <div className="card">
      <h2>
        <Ruler className="icon" />Grade consensus
        <span className="spacer" />
        <span className="hint">median {fmt(r.consensus.median)} · range {fmt(r.consensus.min, 0)}–{fmt(r.consensus.max, 0)}</span>
      </h2>
      <svg className="consensus-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grade level consensus across six formulas">
        {bands.map(([a, b, band]) => (
          <rect key={band} x={gx(a)} y={AXIS_Y - 7} width={gx(b) - gx(a)} height={14} fill={`var(--${band})`} opacity={0.14} />
        ))}
        <line x1={X0} y1={AXIS_Y} x2={X1} y2={AXIS_Y} stroke="var(--line-strong)" strokeWidth={1.5} />
        {[1, 4, 7, 10, 13, 16].map((g) => (
          <g key={g}>
            <line x1={gx(g)} y1={AXIS_Y - 3} x2={gx(g)} y2={AXIS_Y + 3} stroke="var(--ink-3)" strokeWidth={1} />
            <text x={gx(g)} y={AXIS_Y + 16} fontSize={8.5} textAnchor="middle" fill="var(--ink-3)" fontFamily="var(--mono)">{g}</text>
          </g>
        ))}
        <path d={`M ${gx(r.consensus.median)} ${AXIS_Y - 13} l 5 5 l -5 5 l -5 -5 Z`} fill="var(--ink)" />
        {sorted.map((mk, i) => {
          const x = gx(mk.grade)
          const ly = i % 2 === 0 ? 14 : 27
          return (
            <g key={mk.id}>
              <circle cx={x} cy={AXIS_Y} r={3.4} fill="var(--surface)" stroke={`var(--${gradeBand(mk.grade)})`} strokeWidth={2.2} />
              <line x1={x} y1={ly + 5} x2={x} y2={AXIS_Y - 5} stroke="var(--ink-3)" strokeWidth={0.7} strokeDasharray="1.5 1.5" />
              <text x={lx.get(mk.id)} y={ly} fontSize={7.5} textAnchor="middle" fill="var(--ink-2)" fontFamily="var(--mono)" fontWeight={600}>
                {mk.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="consensus-legend">
        <span>FK Flesch–Kincaid</span><span>DC Dale–Chall</span><span>FOG Gunning</span>
        <span>SMOG</span><span>CL Coleman–Liau</span><span>ARI</span>
      </div>
    </div>
  )
}

function RhythmCard({
  r, settings, selected, onSelect
}: {
  r: Analysis
  settings: Settings
  selected: number | null
  onSelect: (i: number | null) => void
}): React.JSX.Element {
  const max = Math.max(...r.sentences.map((s) => s.words), 1)
  const cap = Math.max(settings.longSentence + 10, max)
  const sel: SentenceDetail | null = selected !== null ? r.sentences[selected] : null
  return (
    <div className="card">
      <h2><AlignLeft className="icon" />Sentence rhythm<span className="spacer" /><span className="hint">click a bar</span></h2>
      <div className="rhythm-meta">
        <span>mean <b>{fmt(r.averages.sentenceLength)}</b> words</span>
        <span>variation σ <b>{fmt(r.rhythm.stddev)}</b>{r.rhythm.stddev < 4 && r.sentences.length >= 8 ? ' (monotonous)' : ''}</span>
        <span>longest <b>{r.rhythm.longest?.words ?? 0}</b></span>
      </div>
      <div className="rhythm-strip" role="group" aria-label="Sentence lengths">
        {r.sentences.map((s) => {
          const band = s.words > settings.longSentence ? 'hard' : s.words > settings.longSentence - 5 ? 'moderate' : ''
          return (
            <button
              key={s.i}
              className={`rhythm-bar ${band}${s.i === selected ? ' sel' : ''}`}
              style={{ height: `${Math.max(8, (s.words / cap) * 100)}%` }}
              title={`Sentence ${s.i + 1} — ${s.words} words · ${s.syllables} syllables${s.difficult ? ` · ${s.difficult} unfamiliar` : ''}`}
              aria-label={`Sentence ${s.i + 1}, ${s.words} words`}
              onClick={() => {
                onSelect(s.i === selected ? null : s.i)
                requestAnimationFrame(() => {
                  document.querySelector(`.sent[data-sent="${s.i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                })
              }}
            />
          )
        })}
      </div>
      {sel && (
        <div className="sentence-detail">
          <p className="quote">“{sel.text}”</p>
          <div className="meta">
            <span><b>{sel.words}</b> words</span>
            <span><b>{sel.syllables}</b> syllables</span>
            <span><b>{sel.difficult}</b> unfamiliar words</span>
            <span>sentence <b>{sel.i + 1}</b> of {r.sentences.length}</span>
          </div>
          {splitHint(sel.text, settings.longSentence) && (
            <div className="split"><Lightbulb className="icon" size={12} /> {splitHint(sel.text, settings.longSentence)}</div>
          )}
        </div>
      )}
    </div>
  )
}

const FORMULAS: Array<{
  id: string
  name: string
  desc: string
  val: (r: Analysis) => string
  pos: (r: Analysis) => number
  band: (r: Analysis) => string
}> = [
  { id: 'flesch', name: 'Flesch Reading Ease', desc: '1948. Higher is easier; 60–70 is plain English. From sentence length and syllables per word.',
    val: (r) => fmt(r.scores.flesch, 0), pos: (r) => 100 - Math.max(0, Math.min(100, r.scores.flesch)), band: (r) => fleschBand(r.scores.flesch)[0] },
  { id: 'fk', name: 'Flesch–Kincaid Grade', desc: 'US school grade estimated from sentence length and syllables per word.',
    val: (r) => 'Grade ' + fmt(r.scores.fk), pos: (r) => (r.scores.fk / 17) * 100, band: (r) => gradeBand(r.scores.fk) },
  { id: 'daleChall', name: 'Dale–Chall', desc: '1948, revised 1995. Weights words outside a list of ~3,000 familiar words against sentence length.',
    val: (r) => `${fmt(r.scores.daleChall.adjusted)} · ${r.scores.daleChall.label}`, pos: (r) => (r.scores.daleChall.gradeNum / 17) * 100, band: (r) => gradeBand(r.scores.daleChall.gradeNum) },
  { id: 'fog', name: 'Gunning Fog', desc: '1952. Grade from sentence length and the percentage of complex (3+ syllable) words.',
    val: (r) => 'Grade ' + fmt(r.scores.fog), pos: (r) => (r.scores.fog / 17) * 100, band: (r) => gradeBand(r.scores.fog) },
  { id: 'smog', name: 'SMOG', desc: '1969. Grade from polysyllable density; most reliable with 30+ sentences.',
    val: (r) => 'Grade ' + fmt(r.scores.smog), pos: (r) => (r.scores.smog / 17) * 100, band: (r) => gradeBand(r.scores.smog) },
  { id: 'colemanLiau', name: 'Coleman–Liau', desc: '1975. Grade from letters and sentences per 100 words — no syllable counting.',
    val: (r) => 'Grade ' + fmt(r.scores.colemanLiau), pos: (r) => (r.scores.colemanLiau / 17) * 100, band: (r) => gradeBand(r.scores.colemanLiau) },
  { id: 'ari', name: 'Automated Readability Index', desc: '1967. Grade from characters per word and words per sentence.',
    val: (r) => 'Grade ' + fmt(r.scores.ari), pos: (r) => (r.scores.ari / 17) * 100, band: (r) => gradeBand(r.scores.ari) },
  { id: 'lix', name: 'LIX', desc: '1968 (Björnsson). Sentence length plus the percentage of long words (7+ letters). Under 40 reads easily.',
    val: (r) => fmt(r.scores.lix, 0), pos: (r) => (r.scores.lix / 70) * 100,
    band: (r) => (r.scores.lix < 35 ? 'easy' : r.scores.lix < 45 ? 'moderate' : r.scores.lix < 55 ? 'hard' : 'veryhard') }
]

function FormulasCard({ r }: { r: Analysis }): React.JSX.Element {
  return (
    <div className="card">
      <h2><FileText className="icon" />Formulas<span className="spacer" /><span className="hint">expand for notes</span></h2>
      {FORMULAS.map((f) => (
        <details className="formula" key={f.id}>
          <summary>
            <span className="fname">{f.name}</span>
            <span className={`fval b-${f.band(r)}`}>{f.val(r)}</span>
            <span className="fbar"><i style={{ left: `${Math.max(2, Math.min(98, f.pos(r)))}%` }} /></span>
          </summary>
          <div className="fdesc">{f.desc}</div>
        </details>
      ))}
    </div>
  )
}

function VocabCard({ r }: { r: Analysis }): React.JSX.Element {
  const [sort, setSort] = useState<'freq' | 'alpha'>('freq')
  const [query, setQuery] = useState('')
  const list = useMemo(() => {
    const merged = new Map<string, { w: string; n: number; awl: boolean }>()
    Object.entries(r.difficult.freq).forEach(([w, n]) => merged.set(w, { w, n, awl: !!r.awl.freq[w] }))
    Object.entries(r.awl.freq).forEach(([w, n]) => {
      if (!merged.has(w)) merged.set(w, { w, n, awl: true })
    })
    let out = [...merged.values()]
    if (query) out = out.filter((x) => x.w.includes(query))
    out.sort(sort === 'alpha' ? (a, b) => a.w.localeCompare(b.w) : (a, b) => b.n - a.n || a.w.localeCompare(b.w))
    return out
  }, [r, sort, query])
  const maxN = list.length ? list[0].n : 1

  const locate = (word: string): void => {
    const matches = document.querySelectorAll(`[data-w="${CSS.escape(word)}"]`)
    if (!matches.length) return
    matches.forEach((el) => {
      el.classList.remove('w-flash')
      void (el as HTMLElement).offsetWidth
      el.classList.add('w-flash')
    })
    matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="card">
      <h2><BookOpen className="icon" />Vocabulary</h2>
      <div className="pct-line"><span>Unfamiliar (Dale–Chall)</span><b>{fmt(r.difficult.pct)}% · {r.difficult.count} words</b></div>
      <div className="pct-line"><span>Academic (AWL)</span><b>{fmt(r.awl.pct)}% · {r.awl.count} words</b></div>
      <div className="vocab-controls">
        <div className="search-box">
          <Search className="icon" />
          <input type="search" placeholder="Filter words…" value={query} onChange={(e) => setQuery(e.target.value.toLowerCase())} aria-label="Filter word list" />
        </div>
        <div className="select-wrap">
          <select value={sort} onChange={(e) => setSort(e.target.value as 'freq' | 'alpha')} aria-label="Sort word list">
            <option value="freq">By frequency</option>
            <option value="alpha">A–Z</option>
          </select>
          <ChevronDown className="icon" />
        </div>
      </div>
      <div className="word-rows">
        {list.length === 0 && (
          <div className="vocab-empty">{query ? `No matches for “${query}”.` : 'Every word is on the familiar list — nicely done.'}</div>
        )}
        {list.slice(0, 120).map((x) => (
          <button key={x.w} className={'word-row' + (x.awl ? ' awl' : '')} onClick={() => locate(x.w)}>
            <span className="wname">
              {x.w}
              {x.awl && <span style={{ color: 'var(--awl)', fontSize: 10 }}> AWL</span>}
            </span>
            <span className="wbar" style={{ width: Math.max(6, (x.n / maxN) * 60) }} />
            <span className="wcount">×{x.n}</span>
          </button>
        ))}
        {list.length > 120 && <div className="vocab-empty">…and {list.length - 120} more. Filter to narrow down.</div>}
      </div>
    </div>
  )
}

function StructureCard({ r, aud }: { r: Analysis; aud: Audience }): React.JSX.Element {
  const row = (label: string, value: string, cls?: string, note?: string): React.JSX.Element => (
    <div className="stat-row" key={label}>
      <span>{label}</span>
      <span>
        <b className={cls}>{value}</b>
        {note && <span style={{ color: 'var(--ink-3)', fontSize: 11 }}> {note}</span>}
      </span>
    </div>
  )
  return (
    <div className="card">
      <h2><Pilcrow className="icon" />Structure</h2>
      <div className="stat-rows">
        {row('Average sentence', `${fmt(r.averages.sentenceLength)} words`, r.averages.sentenceLength <= aud.aslMax ? 'ok' : 'warn', `target ≤ ${aud.aslMax}`)}
        {row(`Long sentences (>${r.targets.longSentence} words)`, String(r.longSentences.length), r.longSentences.length ? 'warn' : 'ok')}
        {row('Average paragraph', `${fmt(r.averages.paragraphWords, 0)} words`, r.averages.paragraphWords <= 150 ? 'ok' : 'warn', 'target ≤ 150')}
        {row('Long paragraphs (>150 words)', String(r.longParagraphs.length), r.longParagraphs.length ? 'warn' : 'ok')}
        {row(
          'Headings',
          r.counts.headings > 0 ? `${r.counts.headings} · 1 per ${fmt(1 / r.principles.headingDensity, 1)} paras` : '0',
          r.counts.paragraphs >= 3 && r.principles.headingDensity < 0.2 ? 'warn' : 'ok',
          'target ≥ 1 per 5'
        )}
        {row('Average word length', `${fmt(r.averages.wordLength)} letters`)}
        {row('Syllables per word', fmt(r.averages.syllablesPerWord, 2))}
        {row('Complex words (3+ syllables)', String(r.complexWords))}
      </div>
    </div>
  )
}

function PrinciplesCard({ r, audienceKey }: { r: Analysis; audienceKey: string }): React.JSX.Element {
  const row = (label: string, value: string, cls?: string, note?: string): React.JSX.Element => (
    <div className="stat-row" key={label}>
      <span>{label}</span>
      <span>
        <b className={cls}>{value}</b>
        {note && <span style={{ color: 'var(--ink-3)', fontSize: 11 }}> {note}</span>}
      </span>
    </div>
  )
  const p = r.principles
  return (
    <div className="card">
      <h2><Lightbulb className="icon" />Principles<span className="spacer" /><span className="hint">readability foundations</span></h2>
      <div className="stat-rows">
        {row('Lists', p.listItems > 0 ? `${p.listItems} items` : 'none', p.listItems > 0 ? 'ok' : undefined, 'chunking')}
        {row('Long comma sequences', String(p.commaHeavy.length), p.commaHeavy.length ? 'warn' : 'ok', 'list candidates')}
        {row('Opens with welcome / thanks', p.welcomeStart ? 'Yes' : 'No', p.welcomeStart ? 'warn' : 'ok', p.welcomeStart ? 'move to end' : '')}
        {row('Verbs over nouns', `${fmt(p.nominalisations.per100)} per 100`, p.nominalisations.per100 > 5 ? 'warn' : 'ok', 'target ≤ 5')}
        {row('Addresses the reader', `${p.readerAddress.count}× “you”`, p.readerAddress.count > 0 ? 'ok' : audienceKey === 'academic' ? undefined : 'warn', audienceKey === 'academic' ? 'optional for academic' : '')}
      </div>
    </div>
  )
}

function SuggestionsCard({ r, aud, audienceKey }: { r: Analysis; aud: Audience; audienceKey: string }): React.JSX.Element {
  const sugg = suggestionsFor(r, aud, audienceKey)
  return (
    <div className="card">
      <h2><Lightbulb className="icon" />Suggestions<span className="spacer" /><span className="hint">{sugg.length}</span></h2>
      {sugg.length === 0 && (
        <div className="vocab-empty">Nothing pressing. Structure, sentences and vocabulary all sit within the {aud.label.toLowerCase()} targets.</div>
      )}
      {sugg.map((s) => (
        <div className="sugg" key={s.title}>
          <Lightbulb className="icon" size={15} />
          <div className="s-body">
            <b>{s.title}</b>
            {s.quote && <p><q>{s.quote}</q></p>}
            <p>{s.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- dashboard ---------- */

type Props = {
  analysis: Analysis | null
  wordCount: number
  settings: Settings
  audience: Audience
  selectedSentence: number | null
  onSelectSentence: (i: number | null) => void
}

export default function Dashboard(props: Props): React.JSX.Element {
  const { analysis: r, wordCount } = props
  return (
    <aside className="pane" aria-label="Analysis dashboard">
      <div className="pane-head">
        Analysis
        <div className="spacer" />
        <span className="hint">Targets: {props.audience.label}</span>
      </div>
      <div className="pane-body">
        <div className="dash-body">
          {!r ? (
            <div className="card">
              <h2><Gauge className="icon" />Analysis</h2>
              <div className="vocab-empty">
                {wordCount === 0
                  ? `The dashboard appears once there are ${MIN_WORDS} words to work with.`
                  : `${MIN_WORDS - wordCount} more words needed before the numbers mean anything.`}
              </div>
            </div>
          ) : (
            <>
              <ScoreCard r={r} aud={props.audience} />
              <ConsensusCard r={r} />
              <RhythmCard r={r} settings={props.settings} selected={props.selectedSentence} onSelect={props.onSelectSentence} />
              <FormulasCard r={r} />
              <VocabCard r={r} />
              <StructureCard r={r} aud={props.audience} />
              <PrinciplesCard r={r} audienceKey={props.settings.audience} />
              <SuggestionsCard r={r} aud={props.audience} audienceKey={props.settings.audience} />
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
