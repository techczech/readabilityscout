// Entry of the Settings window: the shared @bridle/settings-react window over this app's schema and
// command registry. State and every action come from the main process through the preload bridge.
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { SettingsWindow, type RowHint, type SheetState } from '@bridle/settings-react'
import type { SectionRequest, SettingsView } from '@bridle/settings-electron'
import '@bridle/settings-react/settings.css'
import './settings-page.css'
import { MENUS, registry } from '../../shared/commands'
import { schema } from '../../shared/settings-schema'

const bridge = window.bridleSettings

const ROW_HINTS: Record<string, RowHint> = {
  'analysis.audience': { control: 'segmented', summary: 'Targets behind the verdict and suggestions', example: 'academic' },
  'analysis.longSentence': { summary: 'Sentences with more words than this are flagged', example: '30' },
  'analysis.readingWpm': { summary: 'For the reading-time estimate', step: 10, example: '250' },
  'appearance.theme': { control: 'segmented', summary: 'Light is the identity; dark is an option', example: 'dark' },
  'annotations.unfamiliar': { summary: 'Mark words outside the familiar list', example: 'off' },
  'annotations.academic': { summary: 'Mark Academic Word List words', example: 'off' },
  'annotations.longSentences': { summary: 'Mark sentences over the threshold', example: 'off' }
}

type Opened = { section: string; sheet?: SheetState; n: number }

function SettingsApp(): React.JSX.Element | null {
  const [view, setView] = useState<SettingsView | null>(null)
  const [opened, setOpened] = useState<Opened>({ section: 'general', n: 0 })
  const [seenAt, setSeenAt] = useState(() => Date.now())

  useEffect(() => {
    const open = async (req: SectionRequest): Promise<void> => {
      let sheet: SheetState | undefined
      if (req.action === 'import') {
        const picked = await bridge.importPick()
        if (picked) sheet = { kind: picked.preview.refused ? 'refused' : 'import', fileName: picked.fileName, preview: picked.preview }
      }
      setOpened((o) => ({ section: req.section, ...(sheet ? { sheet } : {}), n: o.n + 1 }))
    }
    void bridge.view().then((v) => {
      setView(v)
      if (v.request) void open(v.request)
    })
    const offChanged = bridge.onChanged(setView)
    const offSection = bridge.onSection((r) => void open(r))
    return () => {
      offChanged()
      offSection()
    }
  }, [])

  if (!view) return null
  return (
    <>
      <div className="rs-titlebar">Settings</div>
      <SettingsWindow
        key={opened.n}
        className="rs-settings"
        schema={schema}
        state={view.state}
        registry={registry}
        menus={MENUS}
        appInfo={view.appInfo}
        actions={bridge}
        slots={view.slots}
        rowHints={ROW_HINTS}
        changesSeenAt={seenAt}
        onChangesSeen={setSeenAt}
        initial={{ section: opened.section, ...(opened.sheet ? { sheet: opened.sheet } : {}) }}
      />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>
)
