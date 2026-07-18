import React, { useMemo } from 'react'
import { ScanText, Ruler } from 'lucide-react'
import type { Settings } from '../../../shared/ipc'
import { isAcademic, isFamiliar, splitParagraphs, type Analysis } from '../analysis/engine'
import { SAMPLES } from '../analysis/samples'

const MIN_WORDS = 30
const WORD_ANNOTATION_CAP = 3000 // above this, annotate per sentence only (render cost)

type Props = {
  text: string
  analysis: Analysis | null
  wordCount: number
  settings: Settings
  selectedSentence: number | null
  onToggleLayer: (key: 'hlDiff' | 'hlAwl' | 'hlLong') => void
  onLoadSample: (id: string) => void
}

function annotate(sentence: string, wordLevel: boolean): React.ReactNode {
  if (!wordLevel) return sentence
  const out: React.ReactNode[] = []
  const re = /[A-Za-z']+/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(sentence)) !== null) {
    out.push(sentence.slice(last, m.index))
    const w = m[0]
    const lw = w.toLowerCase()
    const cls = 'w' + (isFamiliar(lw) ? '' : ' w-diff') + (isAcademic(lw) ? ' w-awl' : '')
    out.push(
      <span key={k++} className={cls} data-w={lw}>
        {w}
      </span>
    )
    last = m.index + w.length
  }
  out.push(sentence.slice(last))
  return out
}

export default function ReaderPane(props: Props): React.JSX.Element {
  const { text, analysis, wordCount, settings } = props
  const wordLevel = wordCount <= WORD_ANNOTATION_CAP

  const body = useMemo(() => {
    if (!analysis) return null
    const paras = splitParagraphs(text)
    const sents = analysis.sentences
    return paras.map((p, pi) => {
      if (p.heading) {
        return p.text.split('\n').map((line, li) => {
          const t = line.trim().replace(/^#+\s*/, '')
          return t ? <h3 key={`${pi}-${li}`}>{t}</h3> : null
        })
      }
      const inPara = sents.filter((s) => s.start >= p.start && s.start < p.end)
      if (!inPara.length) return <p key={pi}>{p.text}</p>
      return (
        <p key={pi}>
          {inPara.map((s) => (
            <React.Fragment key={s.i}>
              <span
                className={
                  'sent' +
                  (s.words > settings.longSentence ? ' s-long' : '') +
                  (s.i === props.selectedSentence ? ' s-sel' : '')
                }
                data-sent={s.i}
              >
                {annotate(s.text, wordLevel)}
              </span>{' '}
            </React.Fragment>
          ))}
        </p>
      )
    })
  }, [analysis, text, settings.longSentence, props.selectedSentence, wordLevel])

  const chip = (
    key: 'hlDiff' | 'hlAwl' | 'hlLong',
    cls: string,
    label: string,
    kbd: string,
    title: string
  ): React.JSX.Element => (
    <button className={`chip ${cls}`} aria-pressed={settings[key]} title={title} onClick={() => props.onToggleLayer(key)}>
      <span className="dot" />
      {label} <kbd>{kbd}</kbd>
    </button>
  )

  return (
    <section className="pane" aria-label="Annotated text">
      <div className="pane-head">
        Annotations
        <div className="spacer" />
        {!wordLevel && analysis && <span className="legend-note">word marks pause above {WORD_ANNOTATION_CAP.toLocaleString()} words</span>}
        <div className="legend" role="group" aria-label="Annotation layers">
          {chip('hlDiff', 'diff', 'Unfamiliar', 'D', 'Words outside the Dale–Chall familiar list')}
          {chip('hlAwl', 'awl', 'Academic', 'A', 'Academic Word List words')}
          {chip('hlLong', 'long', 'Long', 'L', 'Sentences over the length threshold')}
        </div>
      </div>
      <div className="pane-body">
        {analysis ? (
          <div className="reader" tabIndex={0} aria-label="Annotated text view">
            {body}
          </div>
        ) : (
          <div className="empty">
            {wordCount > 0 ? <Ruler className="icon" size={34} /> : <ScanText className="icon" size={34} />}
            <h2>{wordCount > 0 ? `${MIN_WORDS - wordCount} more words to go` : 'Open a file or paste a text'}</h2>
            <p>
              {wordCount > 0
                ? `Readability formulas need at least ${MIN_WORDS} words to say anything reliable. Keep typing, or load a sample below.`
                : 'Open any text file from disk (⌘O), paste on the left, or load one of the bundled mock samples:'}
            </p>
            <div className="sample-grid">
              {SAMPLES.map((s, i) => (
                <button key={s.id} className="sample-card" onClick={() => props.onLoadSample(s.id)}>
                  <b>
                    {s.title} <kbd>{i + 1}</kbd>
                  </b>
                  <span>{s.level}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
