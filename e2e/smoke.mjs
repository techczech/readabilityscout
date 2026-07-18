// Runtime smoke test (slidewell pattern): launch the built app, open a real file
// from disk via IPC, and verify the whole analysis pipeline renders. Also checks
// the settings changelog round-trip and the cheat-sheet.
// Run: `node e2e/smoke.mjs` (after `bunx electron-vite build`), or `bun run test:smoke`.
import { _electron as electron } from 'playwright'
import { writeFileSync } from 'node:fs'

const FIXTURE = '/tmp/rs-smoke-fixture.txt'
writeFileSync(
  FIXTURE,
  'Compost needs two kinds of material. Greens are wet things like vegetable peelings and grass cuttings. Browns are dry things like cardboard and dead leaves.\n\nAim for roughly two parts brown to one part green. This balance gives the microbes both energy and air. Turn the heap every few weeks so air can reach the middle.\n'
)

const out = (o) => console.log(JSON.stringify(o))
const app = await electron.launch({ args: ['.'] })
try {
  const win = await app.firstWindow({ timeout: 20000 })
  await win.waitForLoadState('domcontentloaded')

  const title = await win.title()

  // Empty state renders before any file is opened.
  const emptyVisible = (await win.locator('.empty h2').count()) === 1

  // Load-bearing path: read a real file from disk through the main process.
  await win.evaluate((p) => window.rs.readFile(p), FIXTURE).then(async (read) => {
    if (!read.ok) throw new Error('readFile failed: ' + read.reason)
    // Feed it through the same path as the dialog: simulate the renderer accepting it.
    await win.evaluate((content) => {
      const ta = document.getElementById('rs-editor')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(ta, content)
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    }, read.content)
  })
  await win.waitForTimeout(500) // debounce + render

  const gauge = await win.locator('.gauge-centre .big').first().textContent()
  const cards = await win.locator('.dash-body .card').count()
  const rhythmBars = await win.locator('.rhythm-bar').count()
  const unfamiliarSpans = await win.locator('.w.w-diff').count()
  const fileWords = await win.locator('.editor-status').first().textContent()

  // Rhythm bar click selects the sentence in the reader.
  await win.locator('.rhythm-bar').first().click()
  await win.waitForTimeout(200)
  const selInReader = await win.locator('.sent.s-sel').count()
  const detailCard = await win.locator('.sentence-detail').count()

  // Settings: change audience, verify changelog round-trip via main process.
  await win.evaluate(() => window.rs.setSetting('audience', 'broad'))
  const changelog = await win.evaluate(() => window.rs.getChangelog())
  const changelogOk =
    changelog.length > 0 && changelog[0].key === 'audience' && changelog[0].newValue === 'broad'
  await win.evaluate(() => window.rs.resetSetting('audience'))

  // Settings drawer + cheat-sheet open.
  await win.keyboard.press('Escape')
  await win.evaluate(() => window.rs.getSettings()) // warm
  await win.keyboard.press('s')
  await win.waitForTimeout(300)
  const drawerOpen = await win.locator('.drawer.show').count()
  const switchesVisible = await win.locator('.drawer .switch').count()
  await win.keyboard.press('Escape')
  await win.keyboard.press('?')
  await win.waitForTimeout(300)
  const helpOpen = await win.locator('.modal.show').count()
  const shortcutRows = await win.locator('.keys-table tr').count()

  const pass =
    title === 'ReadabilityScout' &&
    emptyVisible &&
    Number(gauge) > 0 &&
    cards === 7 &&
    rhythmBars === 6 &&
    unfamiliarSpans > 0 &&
    selInReader === 1 &&
    detailCard === 1 &&
    changelogOk &&
    drawerOpen === 1 &&
    switchesVisible === 3 &&
    helpOpen === 1 &&
    shortcutRows >= 12

  out({
    pass,
    title,
    emptyVisible,
    gauge,
    cards,
    rhythmBars,
    unfamiliarSpans,
    selInReader,
    detailCard,
    changelogOk,
    drawerOpen,
    switchesVisible,
    helpOpen,
    shortcutRows,
    fileWords: fileWords?.replace(/\s+/g, ' ').trim()
  })
  process.exitCode = pass ? 0 : 1
} finally {
  await app.close()
}
