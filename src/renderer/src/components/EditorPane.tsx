import React from 'react'
import { Trash2, BookOpen } from 'lucide-react'
import type { Analysis } from '../analysis/engine'
import { fmtTime } from '../analysis/insights'
import type { OpenFile } from '../App'

type Props = {
  text: string
  file: OpenFile | null
  modified: boolean
  externalChange: boolean
  analysis: Analysis | null
  wordCount: number
  onEdit: (value: string) => void
  onClear: () => void
  onReload: () => void
}

export default function EditorPane(props: Props): React.JSX.Element {
  const { analysis, wordCount } = props
  return (
    <section className="pane" aria-label="Text editor">
      <div className="pane-head">
        Your text
        <div className="spacer" />
        {props.modified && <span className="pill modified">edited</span>}
        <button className="btn icon-only" onClick={props.onClear} title="Clear the text" aria-label="Clear the text">
          <Trash2 className="icon" />
        </button>
      </div>
      <textarea
        id="rs-editor"
        value={props.text}
        onChange={(e) => props.onEdit(e.target.value)}
        placeholder="Paste or type at least 30 words, or open a file (⌘O)…"
        aria-label="Text to analyse"
        spellCheck={false}
      />
      <footer className="editor-status" aria-live="polite">
        <span><b>{wordCount}</b> words</span>
        <span><b>{analysis ? analysis.counts.sentences : 0}</b> sentences</span>
        <span><b>{analysis ? analysis.counts.paragraphs : 0}</b> paragraphs</span>
        <span style={{ flex: 1 }} />
        {props.externalChange && (
          <span className="pill ext">
            changed on disk — <button onClick={props.onReload}>reload</button>
          </span>
        )}
        {analysis && (
          <span>
            <BookOpen className="icon" size={13} /> {fmtTime(analysis.time.readingMin)} reading
          </span>
        )}
      </footer>
    </section>
  )
}
