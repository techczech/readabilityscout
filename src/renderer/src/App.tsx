import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Settings, RecentFile } from '../../shared/ipc'
import { MAIN_COMMANDS, commandForEvent, registry, type CommandContext, type CommandId } from '../../shared/commands'
import { analyse, normaliseMarkdown, tokenizeWords, type Analysis } from './analysis/engine'
import { SAMPLES } from './analysis/samples'
import { AUDIENCES } from './analysis/insights'
import AppBar from './components/AppBar'
import EditorPane from './components/EditorPane'
import ReaderPane from './components/ReaderPane'
import Dashboard from './components/Dashboard'
import HelpModal from './components/HelpModal'

const MIN_WORDS = 30

export type OpenFile = { path: string; name: string; extracted: 'pdf' | 'docx' | null }

export default function App(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [bindings, setBindings] = useState<Record<string, string>>({})
  const [recents, setRecents] = useState<RecentFile[]>([])

  const [text, setText] = useState('')
  const [file, setFile] = useState<OpenFile | null>(null)
  const [modified, setModified] = useState(false)
  const [externalChange, setExternalChange] = useState(false)
  const [selectedSentence, setSelectedSentence] = useState<number | null>(null)

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
    const apply = (snap: { settings: Settings; bindings: Record<string, string> }): void => {
      setSettings(snap.settings)
      setBindings(snap.bindings)
    }
    void window.rs.getSettings().then(apply)
    void window.rs.getRecents().then(setRecents)
    // The Settings window, the settings CLI and imports change the same store.
    return window.rs.onSettingsChanged(apply)
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

  /* --- Settings mutations (main process persists + logs; the Settings window is the full editor) --- */
  const setSetting = useCallback(async (key: keyof Settings, value: unknown) => {
    await window.rs.setSetting(key, value)
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
    return off
  }, [acceptRead])

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

  /* --- Commands: one handler per registry command; keys and the menu bar both land here --- */
  const ctx: CommandContext = useMemo(() => ({ hasFile: file !== null, hasAnalysis: analysis !== null }), [file, analysis])
  useEffect(() => {
    void window.rs.setContext(ctx) // the menu bar greys out what is unavailable
  }, [ctx])

  const handlers: Partial<Record<CommandId, () => void>> = {
    open: openDialog,
    reload,
    'recent-files': () => document.getElementById('rs-recents')?.click(),
    'clear-recents': () => void window.rs.clearRecents().then(setRecents),
    'sample-1': () => loadSample(SAMPLES[0].id),
    'sample-2': () => loadSample(SAMPLES[1].id),
    'sample-3': () => loadSample(SAMPLES[2].id),
    'sample-4': () => loadSample(SAMPLES[3].id),
    'focus-editor': () => document.getElementById('rs-editor')?.focus(),
    'clear-text': clearText,
    'copy-report': () => document.getElementById('rs-copy')?.click(),
    'save-json': () => document.getElementById('rs-export')?.click(),
    'toggle-diff': () => settings && void setSetting('hlDiff', !settings.hlDiff),
    'toggle-awl': () => settings && void setSetting('hlAwl', !settings.hlAwl),
    'toggle-long': () => settings && void setSetting('hlLong', !settings.hlLong),
    cheat: () => setHelpOpen(true),
    dismiss: () => {
      if (helpOpen) {
        setHelpOpen(false)
        // Focus can linger in a now-hidden overlay and would swallow the next single-letter shortcut.
        ;(document.activeElement as HTMLElement | null)?.blur()
      } else {
        const t = document.activeElement as HTMLElement | null
        if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) t.blur()
      }
    }
  }

  const run = (id: string): void => {
    if (MAIN_COMMANDS.has(id)) {
      void window.rs.runCommand(id)
      return
    }
    const reason = registry.byId(id)?.available?.(ctx) ?? null
    if (reason) showToast(reason)
    else handlers[id as CommandId]?.()
  }
  // Event handlers registered once read the newest closure through these refs.
  const runRef = useRef(run)
  runRef.current = run
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings
  const helpOpenRef = useRef(helpOpen)
  helpOpenRef.current = helpOpen

  useEffect(() => window.rs.onCommand((id) => runRef.current(id)), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      const inField = !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)
      const id = commandForEvent(e, bindingsRef.current, { inField, onControl: t?.tagName === 'BUTTON', overlay: helpOpenRef.current })
      if (!id) return
      e.preventDefault()
      runRef.current(id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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
        bindings={bindings}
        audienceLabel={audience.label}
        onOpenDialog={openDialog}
        onOpenPath={openPath}
        onClearRecents={() => void window.rs.clearRecents().then(setRecents)}
        onLoadSample={loadSample}
        onOpenSettings={() => run('settings')}
        onOpenHelp={() => run('cheat')}
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

      <div className={'scrim' + (helpOpen ? ' show' : '')} onClick={() => setHelpOpen(false)} />
      <HelpModal open={helpOpen} bindings={bindings} onClose={() => setHelpOpen(false)} />
      <div className={'toast' + (toast ? ' show' : '')} role="status">
        {toast}
      </div>
    </>
  )
}
