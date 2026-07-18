// Runtime smoke test (family pattern): launch the built app, exercise the
// load-bearing paths through real IPC, and verify the full pipeline.
// Covers: plain text, markdown image-syntax exclusion, principles card,
// PDF + DOCX extraction, legacy .doc rejection, settings changelog, cheat-sheet.
// Run: `node e2e/smoke.mjs` (after `bunx electron-vite build`), or `bun run test:smoke`.
import { _electron as electron } from 'playwright'
import { writeFileSync } from 'node:fs'
import { zipSync, strToU8 } from 'fflate'

/* --- fixtures --- */
writeFileSync(
  '/tmp/rs-smoke-fixture.txt',
  'Compost needs two kinds of material. Greens are wet things like vegetable peelings and grass cuttings. Browns are dry things like cardboard and dead leaves.\n\nAim for roughly two parts brown to one part green. This balance gives the microbes both energy and air. Turn the heap every few weeks so air can reach the middle.\n'
)

// Minimal valid one-page PDF (with leading, so T* advances lines).
const pdfLines = [
  'The urban heat island effect raises city temperatures across the world.',
  'Green roofs and pale surfaces can cool streets by several degrees in summer.'
]
// 12pt keeps lines inside the MediaBox (pdfjs drops runs outside the page box).
const pdfContent = `BT /F1 12 Tf 15 TL 72 720 Td ${pdfLines.map((l) => `(${l}) Tj`).join(' T* ')} ET`
const pdfObjs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${pdfContent.length} >>\nstream\n${pdfContent}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
]
let pdf = '%PDF-1.4\n'
const offsets = []
pdfObjs.forEach((body, i) => {
  offsets.push(pdf.length)
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
})
const xrefPos = pdf.length
pdf += `xref\n0 ${pdfObjs.length + 1}\n0000000000 65535 f \n`
offsets.forEach((off) => (pdf += `${String(off).padStart(10, '0')} 00000 n \n`))
pdf += `trailer\n<< /Size ${pdfObjs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
writeFileSync('/tmp/rs-smoke-fixture.pdf', pdf)

const docxDocument = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t xml:space="preserve">Pursuant to the aforementioned deliberations of the sub-committee, all personnel are hereby notified of the centralised authorisation requirement.</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">The requisition of consumable office supplies shall henceforth be subject to comprehensive verification prior to the approval of any additional procurement request.</w:t></w:r></w:p>
</w:body></w:document>`
writeFileSync(
  '/tmp/rs-smoke-fixture.docx',
  zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    ),
    'word/document.xml': strToU8(docxDocument)
  })
)
writeFileSync('/tmp/rs-smoke-legacy.doc', 'not really a doc file')

/* --- test --- */
const out = (o) => console.log(JSON.stringify(o))
const app = await electron.launch({ args: ['.'] })
try {
  const win = await app.firstWindow({ timeout: 20000 })
  await win.waitForLoadState('domcontentloaded')
  const title = await win.title()
  const emptyVisible = (await win.locator('.empty h2').count()) === 1

  const typeIntoEditor = (content) =>
    win.evaluate((c) => {
      const ta = document.getElementById('rs-editor')
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, c)
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    }, content)

  // Plain text through IPC + editor.
  const readTxt = await win.evaluate((p) => window.rs.readFile(p), '/tmp/rs-smoke-fixture.txt')
  if (!readTxt.ok) throw new Error('readFile failed: ' + readTxt.reason)
  await typeIntoEditor(readTxt.content)
  await win.waitForTimeout(500)

  const gauge = await win.locator('.gauge-centre .big').first().textContent()
  const cards = await win.locator('.dash-body .card').count()
  const rhythmBars = await win.locator('.rhythm-bar').count()
  const unfamiliarSpans = await win.locator('.w.w-diff').count()
  const principlesRows = await win.locator('.card:has-text("Principles") .stat-row').count()

  // Markdown: image alt text and URLs must not count as words or sentences.
  const mdText =
    'Here is a photo from the scene.\n\n![social media people walk away from a burning warehouse](https://ichef.bbci.co.uk/news/480/cpsprodpb/6743/live/ca87eb10-8291-11f1-b45b-4f689a4d3399.png.webp)social media\n\nFire crews arrived at the warehouse shortly after six in the morning. They found the building well alight and began to tackle the flames from two sides. No one was hurt in the fire.'
  await typeIntoEditor(mdText)
  await win.waitForTimeout(500)
  const mdStatus = (await win.locator('.editor-status').first().textContent())?.replace(/\s+/g, ' ')
  const mdWords = Number(mdStatus?.match(/(\d+) words/)?.[1])
  const mdSentences = Number(mdStatus?.match(/(\d+) sentences/)?.[1])
  const mdUrlMarked = await win.locator('.w[data-w="ichef"]').count() // URL must not be annotated either

  // PDF / DOCX / legacy .doc through real IPC.
  const readPdf = await win.evaluate((p) => window.rs.readFile(p), '/tmp/rs-smoke-fixture.pdf')
  const readDocx = await win.evaluate((p) => window.rs.readFile(p), '/tmp/rs-smoke-fixture.docx')
  const readDoc = await win.evaluate((p) => window.rs.readFile(p), '/tmp/rs-smoke-legacy.doc')
  const pdfOk =
    readPdf.ok &&
    readPdf.extracted === 'pdf' &&
    readPdf.content.includes('temperatures across the world.\nGreen') &&
    readPdf.content.includes('summer.')
  const docxOk = readDocx.ok && readDocx.extracted === 'docx' && readDocx.content.includes('aforementioned')
  const docRejected = !readDoc.ok && /old \.doc format/.test(readDoc.reason)

  // DOCX content through the full render path.
  if (readDocx.ok) await typeIntoEditor(readDocx.content)
  await win.waitForTimeout(500)
  const docxGauge = await win.locator('.gauge-centre .big').first().textContent()
  const nominalisationRow = await win.locator('.stat-row:has-text("Verbs over nouns") b').first().textContent()

  // Rhythm selection.
  await win.locator('.rhythm-bar').first().click()
  await win.waitForTimeout(200)
  const selInReader = await win.locator('.sent.s-sel').count()

  // Settings changelog round-trip.
  await win.evaluate(() => window.rs.setSetting('audience', 'broad'))
  const changelog = await win.evaluate(() => window.rs.getChangelog())
  const changelogOk = changelog.length > 0 && changelog[0].key === 'audience' && changelog[0].newValue === 'broad'
  await win.evaluate(() => window.rs.resetSetting('audience'))

  // Drawer + cheat-sheet.
  await win.keyboard.press('Escape')
  await win.keyboard.press('s')
  await win.waitForTimeout(300)
  const drawerOpen = await win.locator('.drawer.show').count()
  const switchesVisible = await win.locator('.drawer .switch').count()
  await win.keyboard.press('Escape')
  await win.keyboard.press('?')
  await win.waitForTimeout(300)
  const helpOpen = await win.locator('.modal.show').count()

  const pass =
    title === 'ReadabilityScout' &&
    emptyVisible &&
    Number(gauge) > 0 &&
    cards === 8 &&
    rhythmBars === 6 &&
    unfamiliarSpans > 0 &&
    principlesRows === 5 &&
    mdWords === 41 &&
    mdSentences === 4 &&
    mdUrlMarked === 0 &&
    pdfOk &&
    docxOk &&
    docRejected &&
    Number(docxGauge) < 20 && // bureaucratic text scores very hard
    parseFloat(nominalisationRow) > 5 &&
    selInReader === 1 &&
    changelogOk &&
    drawerOpen === 1 &&
    switchesVisible === 3 &&
    helpOpen === 1

  out({
    pass, title, emptyVisible, gauge, cards, rhythmBars, unfamiliarSpans, principlesRows,
    mdWords, mdSentences, mdUrlMarked, pdfOk, docxOk, docRejected, docxGauge,
    nominalisationRow, selInReader, changelogOk, drawerOpen, switchesVisible, helpOpen
  })
  process.exitCode = pass ? 0 : 1
} finally {
  await app.close()
}
