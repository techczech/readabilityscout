# Quality gate walkthrough (design-first Gate 5)

## 0.2.0 — 2026-07-18: **pass**

Re-walked after the markdown/principles/formats milestone (ADR 0003). The
smoke test now additionally covers: image-syntax exclusion from words and
sentences (41 words / 4 sentences on the reported BBC-style case), URL
non-annotation, Principles card rows, PDF and DOCX extraction through real IPC,
legacy .doc rejection, and nominalisation flagging of bureaucratic text. All
invariants below still hold; settings state on the dev machine was restored
after testing (annotation layers back on).

## 0.1.x — 2026-07-18: **pass**

Result: **pass**. Verified by `e2e/smoke.mjs` (Playwright driving the real
Electron build through IPC) plus packaged-app launch and window screenshots.

- [x] **No MVP.** All PRD features shipped: open/recents/watch, scratch,
  samples, eight formulas, consensus scale, rhythm strip, vocabulary explorer,
  suggestions, settings, cheat-sheet, export (Markdown + JSON).
- [x] **Settings.** Drawer: audience, theme, annotation layers, thresholds.
  Persisted in `userData/settings.json` (family pattern).
- [x] **Settings searchable + changelog.** Search filters rows; every change
  recorded old → new with timestamp and per-entry Reset (verified via IPC
  round-trip in the smoke test).
- [x] **`?` cheat-sheet.** Lists all 13 shortcuts including ⌘O / ⌘⇧R.
- [x] **Keyboard parity.** All demo shortcuts plus menu accelerators; verified
  `S`, `?`, Esc-focus hand-off in the smoke test.
- [x] **Real icons.** lucide-react throughout.
- [x] **Lists searchable/sortable.** Vocabulary list: filter + frequency/A–Z;
  click-to-locate flashes occurrences in the reader.
- [x] **Empty/error states designed.** No-text, too-short, dashboard
  placeholder, binary/oversize/unreadable toasts, empty changelog, empty
  recents, empty word list.
- [x] **Light identity, dark option.** Theme segmented control; System follows
  the OS. CSS custom properties for both.
- [x] **British spelling.** UI copy, en-GB changelog dates.
- [x] **Gate 4 — load-bearing path live.** File read from disk via main-process
  IPC → full render verified in the packaged `.app` (gauge, rhythm, annotations
  all populated). The native dialog itself (⌘O) is the one path automation
  cannot click; flagged for first-run confirmation by the user.

## Known limitations (accepted)

- Default Electron icon for 0.1.
- Word-level annotation pauses above 3,000 words (sentence-level marks
  continue; noted in the legend).
- No save-back by design (ADR 0002).
