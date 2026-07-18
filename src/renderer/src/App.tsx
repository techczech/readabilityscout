import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Settings, SettingsChange, RecentFile } from '../../shared/ipc'
import { analyse, normaliseMarkdown, tokenizeWords, type Analysis } from './analysis/engine'
import { SAMPLES } from './analysis/samples'
import { AUDIENCES } from './analysis/insights'
import AppBar from './components/AppBar'
import EditorPane from './components/EditorPane'
import ReaderPane from './components/ReaderPane'
import Dashboard from './components/Dashboard'
import SettingsDrawer from './components/SettingsDrawer'
import HelpModal from './components/HelpModal'

const MIN_WORDS = 30

export type OpenFile = { path: string; name: string; extracted: 'pdf' | 'docx' | null }

export default function App(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [changelog, setChangelog] = useState<SettingsChange[]>([])
  const [recents, setRecents] = useState<RecentFile[]>([])

  const [text, setText] = useState('')
  const [file, setFile] = useState<OpenFile | null>(null)
  const [modified, setModified] = useState(false)
  const [externalChange, setExternalChange] = useState(false)
  const [selectedSentence, setSelectedSentence] = useState<number | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }, [])

  /* --- Initial load --- */
  useEffect(() => {
    window.rs.getSettings().then(setSettings)
    window.rs.getChangelog().then(setChangelog)
    window.rs.getRecents().then(setRecents)
  }, [])

  /* --- Theme + annotation layers on <body> (CSS ported 1:1 from the demo) --- */
  useEffect(() => {
    if (!settings) return
    const theme =
      settings.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : settings.theme
    document.body.dataset.theme = theme
    document.body.classList.toggle('hl-diff', settings.hlDiff)
    document.body.classList.toggle('hl-awl', settings.hlAwl)
    document.body.classList.toggle('hl-long', settings.hlLong)
  }, [settings])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => {
      setSettings((s) => {
        if (s?.theme === 'system') document.body.dataset.theme = mq.matches ? 'dark' : 'light'
        return s
      })
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  /* --- Settings mutations (main process persists + logs) --- */
  const setSetting = useCallback(async (key: keyof Settings, value: unknown) => {
    const { settings: next } = await window.rs.setSetting(key, value)
    setSettings(next)
    setChangelog(await window.rs.getChangelog())
  }, [])

  const resetSetting = useCallback(async (key: keyof Settings) => {
    const { settings: next } = await window.rs.resetSetting(key)
    setSettings(next)
    setChangelog(await window.rs.getChangelog())
  }, [])

  /* --- File handling --- */
  const acceptRead = useCallback(
    async (read: Awaited<ReturnType<typeof window.rs.readFile>> | null, source: 'dialog' | 'path' | 'reload') => {
      if (!read) return // dialog cancelled
      if (!read.ok) {
        showToast(read.reason)
        return
      }
      setText(read.content)
      setFile({ path: read.path, name: read.name, extracted: read.extracted })
      setModified(false)
      setExternalChange(false)
      setSelectedSentence(null)
      setRecents(await window.rs.getRecents())
      if (read.extracted && source !== 'reload') showToast(`Text extracted from ${read.extracted === 'pdf' ? 'PDF' : 'Word document'} — layout ignored`)
    },
    [showToast]
  )

  const openDialog = useCallback(() => {
    void window.rs.openDialog().then((r) => acceptRead(r, 'dialog'))
  }, [acceptRead])

  const openPath = useCallback(
    (path: string) => {
      void window.rs.readFile(path).then((r) => acceptRead(r, 'path'))
    },
    [acceptRead]
  )

  const reload = useCallback(() => {
    if (!file) return
    void window.rs.readFile(file.path).then((r) => acceptRead(r, 'reload'))
  }, [file, acceptRead])

  /* External changes: silent reload when the buffer is untouched, pill otherwise. */
  useEffect(() => {
    const off = window.rs.onFileChanged((path) => {
      setFile((current) => {
        if (!current || current.path !== path) return current
        setModified((m) => {
          if (m) setExternalChange(true)
          else void window.rs.readFile(path).then((r) => acceptRead(r, 'reload'))
          return m
        })
        return current
      })
    })
    const offOpen = window.rs.onMenuOpen(openDialog)
    const offReload = window.rs.onMenuReload(reload)
    return () => {
      off()
      offOpen()
      offReload()
    }
  }, [acceptRead, openDialog, reload])

  /* --- Text editing --- */
  const onEdit = useCallback(
    (value: string) => {
      setText(value)
      if (file) setModified(true)
    },
    [file]
  )

  const loadSample = useCallback((id: string) => {
    const s = SAMPLES.find((x) => x.id === id)
    if (!s) return
    void window.rs.unwatch()
    setText(s.text)
    setFile(null)
    setModified(false)
    setExternalChange(false)
    setSelectedSentence(null)
  }, [])

  const clearText = useCallback(() => {
    void window.rs.unwatch()
    setText('')
    setFile(null)
    setModified(false)
    setExternalChange(false)
    setSelectedSentence(null)
  }, [])

  /* --- Analysis (debounced) --- */
  const [debouncedText, setDebouncedText] = useState(text)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedText(text), 160)
    return () => clearTimeout(t)
  }, [text])

  // Matches the analysis engine: markdown syntax never counts as words.
  const wordCount = useMemo(() => tokenizeWords(normaliseMarkdown(debouncedText)).length, [debouncedText])
  const analysis: Analysis | null = useMemo(() => {
    if (wordCount < MIN_WORDS) return null
    return analyse(debouncedText, {
      longSentence: settings?.longSentence ?? 25,
      readingWpm: settings?.readingWpm ?? 238
    })
  }, [debouncedText, wordCount, settings?.longSentence, settings?.readingWpm])

  useEffect(() => {
    if (selectedSentence !== null && analysis && selectedSentence >= analysis.sentences.length)
      setSelectedSentence(null)
  }, [analysis, selectedSentence])

  /* --- Global keyboard (single letters outside editable fields) --- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      const editable =
        t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)
      if (e.key === 'Escape') {
        if (drawerOpen || helpOpen) {
          setDrawerOpen(false)
          setHelpOpen(false)
          // Focus can linger in a now-hidden overlay input and would swallow
          // the next single-letter shortcut.
          ;(document.activeElement as HTMLElement | null)?.blur()
        } else if (editable) (t as HTMLElement).blur()
        return
      }
      if (editable || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (e.key === '?') setHelpOpen(true)
      else if (k === 's') setDrawerOpen(true)
      else if (k === 'e') document.getElementById('rs-editor')?.focus()
      else if (k === 'x') clearText()
      else if (k === 'r') document.getElementById('rs-copy')?.click()
      else if (k === 'j') document.getElementById('rs-export')?.click()
      else if (k === 'd' && settings) void setSetting('hlDiff', !settings.hlDiff)
      else if (k === 'a' && settings) void setSetting('hlAwl', !settings.hlAwl)
      else if (k === 'l' && settings) void setSetting('hlLong', !settings.hlLong)
      else if (k >= '1' && k <= String(SAMPLES.length)) loadSample(SAMPLES[+k - 1].id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen, helpOpen, settings, setSetting, clearText, loadSample])

  if (!settings) return <div className="boot" />

  const audience = AUDIENCES[settings.audience]

  return (
    <>
      <AppBar
        file={file}
        modified={modified}
        recents={recents}
        analysis={analysis}
        settings={settings}
        audienceLabel={audience.label}
        onOpenDialog={openDialog}
        onOpenPath={openPath}
        onClearRecents={() => void window.rs.clearRecents().then(setRecents)}
        onLoadSample={loadSample}
        onOpenSettings={() => setDrawerOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        showToast={showToast}
      />
      <main className="layout">
        <EditorPane
          text={text}
          file={file}
          modified={modified}
          externalChange={externalChange}
          analysis={analysis}
          wordCount={analysis ? analysis.counts.words : wordCount}
          onEdit={onEdit}
          onClear={clearText}
          onReload={reload}
        />
        <ReaderPane
          text={debouncedText}
          analysis={analysis}
          wordCount={wordCount}
          settings={settings}
          selectedSentence={selectedSentence}
          onToggleLayer={(key) => void setSetting(key, !settings[key])}
          onLoadSample={loadSample}
        />
        <Dashboard
          analysis={analysis}
          wordCount={wordCount}
          settings={settings}
          audience={audience}
          selectedSentence={selectedSentence}
          onSelectSentence={setSelectedSentence}
        />
      </main>

      <div
        className={'scrim' + (drawerOpen || helpOpen ? ' show' : '')}
        onClick={() => {
          setDrawerOpen(false)
          setHelpOpen(false)
        }}
      />
      <SettingsDrawer
        open={drawerOpen}
        settings={settings}
        changelog={changelog}
        onClose={() => setDrawerOpen(false)}
        onSet={setSetting}
        onReset={resetSetting}
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <div className={'toast' + (toast ? ' show' : '')} role="status">
        {toast}
      </div>
    </>
  )
}
