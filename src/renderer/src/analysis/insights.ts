/* Suggestions and report building, shared by the dashboard and the export.
 * Rule-based, quotes the text, max five suggestions: structure first, then
 * sentences, then words (readability-skill priority order).
 */
import type { Analysis } from './engine'

export type Audience = {
  label: string
  dcMax: number
  aslMax: number
  diffPctMax: number
}

export const AUDIENCES: Record<'broad' | 'general' | 'academic', Audience> = {
  broad: { label: 'Broad public', dcMax: 6, aslMax: 15, diffPctMax: 5 },
  general: { label: 'General audience', dcMax: 8, aslMax: 20, diffPctMax: 10 },
  academic: { label: 'Academic readers', dcMax: 9.9, aslMax: 25, diffPctMax: 15 }
}

export const SPLIT_CUES = [', and ', ', but ', ', which ', ', because ', ', although ', ', so ', '; ', ' and then ', ' whereas ']

export function splitHint(sentence: string, longThreshold: number): string {
  const words = sentence.split(/\s+/).length
  if (words <= longThreshold) return ''
  for (const cue of SPLIT_CUES) {
    const idx = sentence.toLowerCase().indexOf(cue)
    if (idx > 0) {
      const before = sentence.slice(0, idx).split(/\s+/).length
      const after = words - before
      if (before >= 6 && after >= 6) {
        const word = sentence.substr(idx, cue.length).trim().replace(/[,;]/g, '')
        return `Possible split before “${word}” — both halves would stand alone (${before} + ${after} words).`
      }
    }
  }
  return 'No natural joint to split at — try breaking this into two shorter thoughts.'
}

const PLAIN_ALT: Record<string, string> = {
  utilize: 'use', utilise: 'use', facilitate: 'help', approximately: 'about', commence: 'begin',
  purchase: 'buy', numerous: 'many', demonstrate: 'show', additional: 'extra', sufficient: 'enough',
  obtain: 'get', require: 'need', assist: 'help', attempt: 'try', therefore: 'so', however: 'but',
  implement: 'carry out', subsequently: 'later', prior: 'before', endeavour: 'try', accordingly: 'so',
  pursuant: 'under', henceforth: 'from now on', aforementioned: 'mentioned above', herein: 'here'
}

export type Suggestion = { title: string; quote: string; body: string }

export function suggestionsFor(r: Analysis, aud: Audience, audienceKey: string): Suggestion[] {
  const out: Suggestion[] = []
  // 1. Structure first
  if (r.counts.paragraphs >= 3 && r.counts.headings === 0) {
    out.push({
      title: 'Add headings',
      quote: '',
      body: `This text runs for ${r.counts.paragraphs} paragraphs with no headings. A heading every few paragraphs lets readers scan and find what they need.`
    })
  }
  if (r.longParagraphs.length) {
    const lp = r.longParagraphs[0]
    out.push({
      title: 'Break up a long paragraph',
      quote: lp.preview + '…',
      body: `This paragraph is ${lp.words} words. Paragraphs under 150 words are noticeably easier to stay with.`
    })
  }
  if (r.principles.welcomeStart) {
    out.push({
      title: 'Move the welcome to the end',
      quote: r.sentences[0] ? (r.sentences[0].text.length > 100 ? r.sentences[0].text.slice(0, 100) + '…' : r.sentences[0].text) : '',
      body: 'The text opens with a welcome or thanks. Important information first; courtesies last — readers come for the content.'
    })
  }
  if (r.principles.commaHeavy.length) {
    const s = [...r.principles.commaHeavy].sort((a, b) => b.commas - a.commas)[0]
    out.push({
      title: r.principles.commaHeavy.length === 1 ? 'Turn a long sequence into a list' : `Turn ${r.principles.commaHeavy.length} long sequences into lists`,
      quote: s.text.length > 140 ? s.text.slice(0, 140) + '…' : s.text,
      body: `This sentence chains ${s.commas + 1} parts with commas. A bulleted list is easier to skim, scan and remember.`
    })
  }
  // 2. Sentences
  if (r.longSentences.length) {
    const s = [...r.longSentences].sort((a, b) => b.words - a.words)[0]
    out.push({
      title: `Split ${r.longSentences.length === 1 ? 'a long sentence' : r.longSentences.length + ' long sentences'}`,
      quote: s.text.length > 140 ? s.text.slice(0, 140) + '…' : s.text,
      body: `The longest has ${s.words} words. ${splitHint(s.text, r.targets.longSentence) || 'Aim for an average of 15–20.'}`
    })
  }
  if (r.rhythm.stddev < 4 && r.sentences.length >= 8) {
    out.push({
      title: 'Vary the rhythm',
      quote: '',
      body: `Sentence length barely varies (σ = ${r.rhythm.stddev.toFixed(1)}). Mixing short and longer sentences keeps readers awake.`
    })
  }
  // 3. Words
  if (r.principles.nominalisations.per100 > 5) {
    const top = Object.entries(r.principles.nominalisations.freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => `“${w}”`)
      .join(', ')
    out.push({
      title: 'Turn nouns back into verbs',
      quote: '',
      body: `${r.principles.nominalisations.per100.toFixed(1)} nominalisations per 100 words (${top}). “Make a decision” reads slower than “decide”.`
    })
  }
  if (r.difficult.pct > aud.diffPctMax) {
    const swaps = Object.entries(r.difficult.freq)
      .sort((a, b) => b[1] - a[1])
      .filter(([w]) => PLAIN_ALT[w])
      .slice(0, 3)
      .map(([w]) => `“${w}” → “${PLAIN_ALT[w]}”`)
      .join(', ')
    out.push({
      title: 'Swap unfamiliar words',
      quote: '',
      body: `${r.difficult.pct.toFixed(0)}% of words are outside the familiar list (target ≤ ${aud.diffPctMax}%).${swaps ? ' Try: ' + swaps + '.' : ' The word list shows which to reconsider.'}`
    })
  }
  if (r.principles.readerAddress.count === 0 && audienceKey !== 'academic') {
    out.push({
      title: 'Address the reader',
      quote: '',
      body: '“You” never appears. Addressing the reader signals that what you say applies to them — and they pay more attention.'
    })
  }
  if (audienceKey !== 'academic' && r.awl.count > 0) {
    const top = Object.keys(r.awl.freq).slice(0, 4).map((w) => `“${w}”`).join(', ')
    out.push({
      title: 'Watch the academic register',
      quote: '',
      body: `Academic Word List terms appear ${r.awl.count} times (${top}${r.awl.unique > 4 ? '…' : ''}). Fine for specialists; heavy for everyone else.`
    })
  }
  return out.slice(0, 5)
}

export function fmtTime(min: number): string {
  if (min < 1) return Math.max(1, Math.round(min * 60)) + ' sec'
  const m = Math.floor(min)
  const s = Math.round((min - m) * 60)
  return m + ' min' + (s ? ' ' + s + ' s' : '')
}

export function buildReport(r: Analysis, aud: Audience, audienceKey: string, sourceName: string | null): string {
  const f = (n: number, dp = 1): string => n.toFixed(dp)
  const L: string[] = []
  L.push('# Readability report')
  if (sourceName) L.push(`Source: \`${sourceName}\``)
  L.push('')
  L.push(`Target audience: **${aud.label}**`)
  L.push('')
  L.push('| Metric | Value |')
  L.push('|---|---|')
  L.push(`| Words | ${r.counts.words} |`)
  L.push(`| Sentences | ${r.counts.sentences} |`)
  L.push(`| Paragraphs | ${r.counts.paragraphs} |`)
  L.push(`| Average sentence | ${f(r.averages.sentenceLength)} words (target ≤ ${aud.aslMax}) |`)
  L.push(`| Flesch Reading Ease | ${f(r.scores.flesch, 0)} |`)
  L.push(`| Flesch–Kincaid Grade | ${f(r.scores.fk)} |`)
  L.push(`| Dale–Chall | ${f(r.scores.daleChall.adjusted)} (${r.scores.daleChall.label}) |`)
  L.push(`| Gunning Fog | ${f(r.scores.fog)} |`)
  L.push(`| SMOG | ${f(r.scores.smog)} |`)
  L.push(`| Coleman–Liau | ${f(r.scores.colemanLiau)} |`)
  L.push(`| ARI | ${f(r.scores.ari)} |`)
  L.push(`| LIX | ${f(r.scores.lix, 0)} |`)
  L.push(`| Grade consensus (median) | ${f(r.consensus.median)} |`)
  L.push(`| Unfamiliar words | ${f(r.difficult.pct)}% (${r.difficult.unique} unique) |`)
  L.push(`| Academic (AWL) words | ${f(r.awl.pct)}% (${r.awl.unique} unique) |`)
  L.push(`| Reading time | ${fmtTime(r.time.readingMin)} |`)
  const sugg = suggestionsFor(r, aud, audienceKey)
  if (sugg.length) {
    L.push('')
    L.push('## Suggestions')
    sugg.forEach((s) => L.push(`- **${s.title}** — ${s.body}`))
  }
  L.push('')
  L.push('_Generated by ReadabilityScout._')
  return L.join('\n')
}
