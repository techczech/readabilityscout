import React, { useEffect, useRef, useState } from 'react'
import {
  ScanText, FolderOpen, ChevronDown, Copy, Download, Settings as SettingsIcon,
  CircleQuestionMark, FileText, History
} from 'lucide-react'
import type { RecentFile, Settings } from '../../../shared/ipc'
import type { Analysis } from '../analysis/engine'
import { SAMPLES } from '../analysis/samples'
import { AUDIENCES, buildReport } from '../analysis/insights'
import type { OpenFile } from '../App'

type Props = {
  file: OpenFile | null
  modified: boolean
  recents: RecentFile[]
  analysis: Analysis | null
  settings: Settings
  audienceLabel: string
  onOpenDialog: () => void
  onOpenPath: (path: string) => void
  onClearRecents: () => void
  onLoadSample: (id: string) => void
  onOpenSettings: () => void
  onOpenHelp: () => void
  showToast: (msg: string) => void
}

export default function AppBar(props: Props): React.JSX.Element {
  const { analysis, settings, showToast } = props
  const [recentsOpen, setRecentsOpen] = useState(false)
  const recentsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!recentsOpen) return
    const onDoc = (e: MouseEvent): void => {
      if (!recentsRef.current?.contains(e.target as Node)) setRecentsOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [recentsOpen])

  const copyReport = (): void => {
    if (!analysis) {
      showToast('Nothing to report on yet')
      return
    }
    const md = buildReport(analysis, AUDIENCES[settings.audience], settings.audience, props.file?.path ?? null)
    navigator.clipboard.writeText(md).then(
      () => showToast('Markdown report copied'),
      () => showToast('Copy failed — select and copy manually')
    )
  }

  const exportJson = (): void => {
    if (!analysis) {
      showToast('Nothing to export yet')
      return
    }
    const base = (props.file?.name ?? 'scratch').replace(/\.[^.]+$/, '')
    const payload = JSON.stringify({ source: props.file?.path ?? null, settings, analysis }, null, 2)
    void window.rs.saveExport(`${base}.readability.json`, payload).then((saved) => {
      if (saved) showToast('Analysis saved')
    })
  }

  return (
    <header className="appbar">
      <div className="brand">
        <ScanText className="icon" size={20} />
        <h1>ReadabilityScout</h1>
      </div>
      {props.file && (
        <span className="file-chip" title={props.file.path + (props.file.extracted ? ` (text extracted from ${props.file.extracted.toUpperCase()})` : '')}>
          <FileText className="icon" />
          <span className="fname">{props.file.name}</span>
          {props.file.extracted && <span className="badge">{props.file.extracted}</span>}
          <span className={'watch-dot' + (props.modified ? ' off' : '')} title={props.modified ? 'Edited locally — not following disk' : 'Following changes on disk'} />
        </span>
      )}
      <div className="spacer" />
      <div className="appbar-actions">
        <button className="btn" onClick={props.onOpenDialog} title="Open a text file (⌘O)">
          <FolderOpen className="icon" />Open…
        </button>
        <div className="recents-wrap" ref={recentsRef}>
          <button
            className="btn icon-only"
            onClick={() => setRecentsOpen((v) => !v)}
            title="Recent files"
            aria-label="Recent files"
            aria-expanded={recentsOpen}
          >
            <History className="icon" />
          </button>
          {recentsOpen && (
            <div className="recents-menu" role="menu">
              {props.recents.length === 0 && <div className="recents-empty">No recent files yet.</div>}
              {props.recents.map((r) => (
                <button
                  key={r.path}
                  className="recents-item"
                  role="menuitem"
                  onClick={() => {
                    setRecentsOpen(false)
                    props.onOpenPath(r.path)
                  }}
                >
                  <span className="rname">{r.name}</span>
                  <span className="rpath">{r.path}</span>
                </button>
              ))}
              {props.recents.length > 0 && (
                <button
                  className="btn recents-clear"
                  onClick={() => {
                    props.onClearRecents()
                    setRecentsOpen(false)
                  }}
                >
                  Clear recents
                </button>
              )}
            </div>
          )}
        </div>
        <div className="select-wrap">
          <select
            aria-label="Load a sample text"
            value=""
            onChange={(e) => e.target.value && props.onLoadSample(e.target.value)}
          >
            <option value="">Samples…</option>
            {SAMPLES.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.title}
              </option>
            ))}
          </select>
          <ChevronDown className="icon" />
        </div>
        <button className="btn" id="rs-copy" onClick={copyReport} title="Copy a Markdown report to the clipboard">
          <Copy className="icon" />Copy report <kbd>R</kbd>
        </button>
        <button className="btn icon-only" id="rs-export" onClick={exportJson} title="Save the full analysis as JSON" aria-label="Save analysis as JSON">
          <Download className="icon" />
        </button>
        <button className="btn icon-only" onClick={props.onOpenSettings} title="Settings" aria-label="Settings">
          <SettingsIcon className="icon" />
        </button>
        <button className="btn icon-only" onClick={props.onOpenHelp} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
          <CircleQuestionMark className="icon" />
        </button>
      </div>
    </header>
  )
}
