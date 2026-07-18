# Quality gate walkthrough (design-first Gate 5) — 2026-07-18

Result: **pass**. Verified by `e2e/smoke.mjs` (Playwright driving the real
Electron build through IPC) plus packaged-app launch and window screenshots.

- [x] **No MVP.** All PRD features shipped: open/recents/watch, scratch,
  samples, eight formulas, consensus scale, rhythm strip, vocabulary explorer,
  suggestions, settings, cheat-sheet, export (Markdown + JSON).
- [x] **Settings.** Drawer: audience, theme, annotation layers, thresholds.
  Persisted in `userData/settings.json` (todoscout pattern).
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
