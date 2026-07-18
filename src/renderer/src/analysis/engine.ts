/* ReadabilityScout — analysis engine (TypeScript port of the agent-demos tool).
 * Pure functions only, no DOM. Dale-Chall tokenisation, stemming and scoring
 * ported from 05_skills/readability-skill/scripts/analyze_readability.py with
 * two documented deviations (see docs/adr/0001 in agent-demos and docs/adr/0002
 * here): the stem+e check works as the source intended, and heading paragraphs
 * are detected and excluded from the metrics.
 */
import { DALE_CHALL_WORDS, AWL_WORDS } from './wordlists'

const ABBREVS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Jr', 'Sr', 'vs', 'etc', 'St', 'No']

export type Sentence = { text: string; start: number; end: number }
export type Paragraph = { text: string; start: number; end: number; heading: boolean }

/* --- Markdown normalisation ---------------------------------------------
 * Blank out non-prose markdown so it never counts as words or sentences:
 * image syntax (alt + URL), link URLs (link text kept), bare URLs, HTML tags,
 * and reference-link definition lines. Blanking is LENGTH-PRESERVING (every
 * removed character becomes a space) so sentence offsets still map onto the
 * original text for the reader view.
 */
export function normaliseMarkdown(text: string): string {
  let out = text
  const blank = (s: string): string => s.replace(/[^\n]/g, ' ')
  // Images: whole construct is not prose — alt text and URL both ignored.
  out = out.replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, blank)
  // Reference-style image/link definitions on their own line.
  out = out.replace(/^[ \t]*\[[^\]\n]+\]:[ \t]*\S+[^\n]*$/gm, blank)
  // Inline links: keep the link text, blank the (URL) part.
  out = out.replace(/\]\([^)\n]*\)/g, (m) => ']' + blank(m.slice(1)))
  // Bare URLs.
  out = out.replace(/\bhttps?:\/\/[^\s)\]}>'"]+/g, blank)
  out = out.replace(/\bwww\.[^\s)\]}>'"]+/g, blank)
  // HTML tags (attributes pollute word counts).
  out = out.replace(/<\/?[a-zA-Z][^>\n]*>/g, blank)
  return out
}

/* --- Paragraphs -------------------------------------------------------- */

export function isHeadingLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (t.charAt(0) === '#') return true
  if (t.length > 3 && t.length < 80 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true
  // Title-style heading: a short single line without terminal punctuation.
  const words = t.split(/\s+/).length
  return words <= 8 && !/[.!?…:;,]["'”’)]?$/.test(t)
}

export function splitParagraphs(text: string): Paragraph[] {
  const paras: Paragraph[] = []
  const re = /\n\s*\n/g
  let last = 0
  let m: RegExpExecArray | null
  const pushPara = (chunk: string, offset: number): void => {
    const trimmed = chunk.trim()
    if (!trimmed) return
    const start = offset + chunk.indexOf(trimmed.charAt(0))
    const lines = chunk.split('\n').filter((l) => l.trim())
    const heading = lines.length > 0 && lines.every(isHeadingLine)
    paras.push({ text: trimmed, start, end: start + trimmed.length, heading })
  }
  while ((m = re.exec(text)) !== null) {
    pushPara(text.slice(last, m.index), last)
    last = m.index + m[0].length
  }
  pushPara(text.slice(last), last)
  return paras
}

/* --- Sentences --------------------------------------------------------- */

// Paragraph breaks are hard sentence boundaries even without terminal punctuation.
export function tokenizeSentences(text: string): Sentence[] {
  let prot = text
  ABBREVS.forEach((a) => {
    prot = prot.replace(new RegExp('\\b' + a + '\\.', 'gi'), a + '')
  })
  prot = prot.replace(/\b(i\.e|e\.g)\.\s/gi, (_m, p) => p + ' ')

  const sentences: Sentence[] = []
  const push = (rawSlice: string, offset: number): void => {
    const trimmed = rawSlice.trim()
    if (!trimmed) return
    const start = offset + rawSlice.indexOf(trimmed.charAt(0))
    sentences.push({ text: trimmed, start, end: start + trimmed.length })
  }

  const segRe = /\n\s*\n/g
  let last = 0
  let m: RegExpExecArray | null
  const segments: Array<[number, number]> = []
  while ((m = segRe.exec(prot)) !== null) {
    segments.push([last, m.index])
    last = m.index + m[0].length
  }
  segments.push([last, prot.length])

  segments.forEach(([a, b]) => {
    let start = a
    for (let i = a; i < b; i++) {
      const c = prot[i]
      if (
        (c === '.' || c === '!' || c === '?') &&
        (i === b - 1 || /\s/.test(prot[i + 1]) || prot[i + 1] === '"' || prot[i + 1] === '”')
      ) {
        let end = i + 1
        while (end < b && /["')\]”’]/.test(prot[end])) end++
        push(text.slice(start, end), start)
        start = end
      }
    }
    if (start < b) push(text.slice(start, b), start)
  })
  return sentences
}

export function tokenizeWords(text: string): string[] {
  const m = text.toLowerCase().match(/[a-z']+/g)
  return m ? m.filter((w) => w.length > 0) : []
}

/* --- Word lists -------------------------------------------------------- */

function stemInList(word: string, list: ReadonlySet<string>): boolean {
  const suffixes = ['iest', 'ier', 'ing', 'ied', 'ies', 'est', 'ed', 'er', 'es', 's', 'd', 'r']
  for (const suf of suffixes) {
    if (word.length - suf.length >= 2 && word.slice(-suf.length) === suf) {
      const stem = word.slice(0, word.length - suf.length)
      if (list.has(stem) || list.has(stem + 'e')) return true
      if (suf === 'ied' && list.has(stem + 'y')) return true
      if (suf === 'ies' && list.has(stem + 'y')) return true
    }
  }
  return false
}

export function isFamiliar(word: string): boolean {
  const w = word.toLowerCase().replace(/^'+|'+$/g, '')
  return DALE_CHALL_WORDS.has(w) || stemInList(w, DALE_CHALL_WORDS)
}

export function isAcademic(word: string): boolean {
  const w = word.toLowerCase().replace(/^'+|'+$/g, '')
  return AWL_WORDS.has(w) || stemInList(w, AWL_WORDS)
}

/* --- Syllables --------------------------------------------------------- */

export function countSyllables(wordIn: string): number {
  const word = wordIn.toLowerCase()
  if (word.length <= 3) return 1
  const vowels = 'aeiouy'
  let count = 0
  let prev = false
  for (const ch of word) {
    const isV = vowels.includes(ch)
    if (isV && !prev) count++
    prev = isV
  }
  if (word.endsWith('e') && count > 1) count--
  if (word.endsWith('le') && word.length > 2 && !vowels.includes(word[word.length - 3])) count++
  return Math.max(1, count)
}

/* --- Formulas ---------------------------------------------------------- */

function daleChallGradeLabel(score: number): string {
  if (score <= 4.9) return 'Grade 4 and below'
  if (score <= 5.9) return 'Grades 5–6'
  if (score <= 6.9) return 'Grades 7–8'
  if (score <= 7.9) return 'Grades 9–10'
  if (score <= 8.9) return 'Grades 11–12'
  if (score <= 9.9) return 'College'
  return 'College graduate'
}

function daleChallGradeNum(score: number): number {
  if (score <= 4.9) return 4
  if (score <= 5.9) return 5.5
  if (score <= 6.9) return 7.5
  if (score <= 7.9) return 9.5
  if (score <= 8.9) return 11.5
  if (score <= 9.9) return 13
  return 16
}

const clampGrade = (g: number): number => Math.max(1, Math.min(17, g))

/* --- Result types ------------------------------------------------------ */

export type SentenceDetail = {
  i: number
  text: string
  start: number
  end: number
  words: number
  syllables: number
  difficult: number
  commas: number
}

// Computable signals from the five readability principles (ADR 0003).
export type Principles = {
  readerAddress: { count: number; per100: number } // "you/your" per 100 words
  nominalisations: { count: number; per100: number; freq: Record<string, number> }
  listItems: number
  headingDensity: number // headings per prose paragraph (target ≈ 0.2+)
  welcomeStart: boolean // text opens with welcome/thanks (move to end)
  commaHeavy: SentenceDetail[] // long comma-chains that read better as lists
}

const NOMINALISATION = /(isation|ization|ibility|ality|tion|sion|ment|ness|ity|ance|ence)$/

export type Analysis = {
  counts: { words: number; sentences: number; paragraphs: number; headings: number; syllables: number; characters: number }
  averages: { sentenceLength: number; wordLength: number; syllablesPerWord: number; paragraphWords: number }
  sentences: SentenceDetail[]
  rhythm: { stddev: number; longest: SentenceDetail | null }
  longSentences: SentenceDetail[]
  longParagraphs: Array<{ i: number; words: number; preview: string }>
  difficult: { count: number; unique: number; pct: number; freq: Record<string, number> }
  awl: { count: number; unique: number; pct: number; freq: Record<string, number> }
  complexWords: number
  scores: {
    flesch: number
    fk: number
    daleChall: { raw: number; adjusted: number; label: string; gradeNum: number }
    fog: number
    smog: number
    colemanLiau: number
    ari: number
    lix: number
  }
  consensus: { marks: Array<{ id: string; label: string; grade: number }>; median: number; min: number; max: number }
  time: { readingMin: number; speakingMin: number }
  targets: { longSentence: number; readingWpm: number }
  principles: Principles
}

/* --- Main entry -------------------------------------------------------- */

export function analyse(text: string, opts: { longSentence?: number; readingWpm?: number } = {}): Analysis {
  const longThreshold = opts.longSentence ?? 25
  const readingWpm = opts.readingWpm ?? 238
  const speakingWpm = 140

  // Markdown syntax (images, URLs, HTML tags) is blanked length-preservingly
  // before any counting, so it can never inflate word or sentence statistics.
  // All offsets still map onto the original text for display.
  const normalised = normaliseMarkdown(text)

  const paragraphs = splitParagraphs(normalised)
  const headingParas = paragraphs.filter((p) => p.heading)
  const proseParas = paragraphs.filter((p) => !p.heading)
  const inHeading = (offset: number): boolean => headingParas.some((p) => offset >= p.start && offset < p.end)

  // Metrics run on prose only: headings are signposts, not sentences.
  const sentences = tokenizeSentences(normalised).filter((s) => !inHeading(s.start))
  const proseText = proseParas.map((p) => p.text).join('\n\n')
  const words = tokenizeWords(proseText)

  const totalWords = words.length
  const totalSentences = sentences.length
  let totalSyllables = 0
  let totalChars = 0

  const difficultFreq: Record<string, number> = {}
  const awlFreq: Record<string, number> = {}
  let difficultCount = 0
  let awlCount = 0
  let complexCount = 0
  let longWordCount = 0

  words.forEach((w) => {
    const syl = countSyllables(w)
    totalSyllables += syl
    totalChars += w.length
    if (syl >= 3) complexCount++
    if (w.length > 6) longWordCount++
    if (!isFamiliar(w)) {
      difficultCount++
      difficultFreq[w] = (difficultFreq[w] ?? 0) + 1
    }
    if (isAcademic(w)) {
      awlCount++
      awlFreq[w] = (awlFreq[w] ?? 0) + 1
    }
  })

  const asl = totalSentences ? totalWords / totalSentences : 0
  const spw = totalWords ? totalSyllables / totalWords : 0
  const cpw = totalWords ? totalChars / totalWords : 0
  const diffPct = totalWords ? (difficultCount / totalWords) * 100 : 0
  const complexPct = totalWords ? (complexCount / totalWords) * 100 : 0
  const longWordPct = totalWords ? (longWordCount / totalWords) * 100 : 0

  const dcRaw = 0.1579 * diffPct + 0.0496 * asl
  const dcAdjusted = diffPct > 5 ? dcRaw + 3.6365 : dcRaw

  const sentenceData: SentenceDetail[] = sentences.map((s, i) => {
    const sw = tokenizeWords(s.text)
    let ssyl = 0
    let sdiff = 0
    sw.forEach((w) => {
      ssyl += countSyllables(w)
      if (!isFamiliar(w)) sdiff++
    })
    // Words counted from the normalised span; text displayed from the original.
    return {
      i,
      text: text.slice(s.start, s.end),
      start: s.start,
      end: s.end,
      words: sw.length,
      syllables: ssyl,
      difficult: sdiff,
      commas: (s.text.match(/,/g) ?? []).length
    }
  })

  const paraWordCounts = proseParas.map((p) => tokenizeWords(p.text).length)
  const avgParaWords = paraWordCounts.length ? paraWordCounts.reduce((a, b) => a + b, 0) / paraWordCounts.length : 0
  const longParagraphs = proseParas
    .map((p, i) => ({ i, words: paraWordCounts[i], preview: p.text.slice(0, 120) }))
    .filter((p) => p.words > 150)

  const scores: Analysis['scores'] = {
    flesch: 206.835 - 1.015 * asl - 84.6 * spw,
    fk: 0.39 * asl + 11.8 * spw - 15.59,
    daleChall: {
      raw: dcRaw,
      adjusted: dcAdjusted,
      label: daleChallGradeLabel(dcAdjusted),
      gradeNum: daleChallGradeNum(dcAdjusted)
    },
    fog: 0.4 * (asl + complexPct),
    smog: totalSentences === 0 ? 0 : 1.043 * Math.sqrt(complexCount * (30 / totalSentences)) + 3.1291,
    colemanLiau:
      0.0588 * (totalWords ? (totalChars / totalWords) * 100 : 0) -
      0.296 * (totalWords ? (totalSentences / totalWords) * 100 : 0) -
      15.8,
    ari: 4.71 * cpw + 0.5 * asl - 21.43,
    lix: asl + longWordPct
  }

  const marks = [
    { id: 'fk', label: 'FK', grade: clampGrade(scores.fk) },
    { id: 'daleChall', label: 'DC', grade: clampGrade(scores.daleChall.gradeNum) },
    { id: 'fog', label: 'FOG', grade: clampGrade(scores.fog) },
    { id: 'smog', label: 'SMOG', grade: clampGrade(scores.smog) },
    { id: 'colemanLiau', label: 'CL', grade: clampGrade(scores.colemanLiau) },
    { id: 'ari', label: 'ARI', grade: clampGrade(scores.ari) }
  ].filter((mk) => isFinite(mk.grade) && mk.grade > 0)

  const sorted = marks.map((mk) => mk.grade).sort((a, b) => a - b)
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : 0

  const lengths = sentenceData.map((s) => s.words)
  const variance = lengths.length ? lengths.reduce((a, b) => a + Math.pow(b - asl, 2), 0) / lengths.length : 0

  /* --- Principles (five-principles integration, ADR 0003) --- */
  let readerAddressCount = 0
  const nomFreq: Record<string, number> = {}
  let nomCount = 0
  words.forEach((w) => {
    if (/^(you|your|yours|yourself|yourselves)$/.test(w)) readerAddressCount++
    if (w.length >= 7 && NOMINALISATION.test(w)) {
      nomCount++
      nomFreq[w] = (nomFreq[w] ?? 0) + 1
    }
  })
  const listItems = (normalised.match(/^\s*(?:[-*+•]|\d{1,2}[.)])\s+/gm) ?? []).length
  const firstSentence = sentenceData[0]?.text ?? ''
  const principles: Principles = {
    readerAddress: { count: readerAddressCount, per100: totalWords ? (readerAddressCount / totalWords) * 100 : 0 },
    nominalisations: { count: nomCount, per100: totalWords ? (nomCount / totalWords) * 100 : 0, freq: nomFreq },
    listItems,
    headingDensity: proseParas.length ? headingParas.length / proseParas.length : 0,
    welcomeStart: /^\s*(welcome\b|thank you|thanks for|dear\s)/i.test(firstSentence),
    commaHeavy: sentenceData.filter((s) => s.commas >= 4 && s.words > 20)
  }

  return {
    counts: {
      words: totalWords,
      sentences: totalSentences,
      paragraphs: proseParas.length,
      headings: headingParas.length,
      syllables: totalSyllables,
      characters: totalChars
    },
    averages: { sentenceLength: asl, wordLength: cpw, syllablesPerWord: spw, paragraphWords: avgParaWords },
    sentences: sentenceData,
    rhythm: {
      stddev: Math.sqrt(variance),
      longest: sentenceData.reduce<SentenceDetail | null>((a, s) => (s.words > (a ? a.words : 0) ? s : a), null)
    },
    longSentences: sentenceData.filter((s) => s.words > longThreshold),
    longParagraphs,
    difficult: { count: difficultCount, unique: Object.keys(difficultFreq).length, pct: diffPct, freq: difficultFreq },
    awl: {
      count: awlCount,
      unique: Object.keys(awlFreq).length,
      pct: totalWords ? (awlCount / totalWords) * 100 : 0,
      freq: awlFreq
    },
    complexWords: complexCount,
    scores,
    consensus: { marks, median, min: sorted[0] ?? 0, max: sorted[sorted.length - 1] ?? 0 },
    time: { readingMin: totalWords / readingWpm, speakingMin: totalWords / speakingWpm },
    targets: { longSentence: longThreshold, readingWpm },
    principles
  }
}
