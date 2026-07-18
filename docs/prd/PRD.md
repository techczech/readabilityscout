# PRD — ReadabilityScout

## Who it is for

Dominik, on his Mac. One job: point the app at any text file on disk and see
how readable it is — with the full Readability Studio analysis, not a score.

## Jobs it does

1. Open any text file from disk (dialog, ⌘O, or a recents list).
2. Follow the file: silent reload on external change when the buffer is
   untouched; a "changed on disk — reload" pill when it has been edited locally.
3. Analyse live: eight formulas, grade consensus, sentence rhythm, word-level
   annotations, vocabulary explorer, structure stats, suggestions.
4. Paste/type scratch text with the same analysis (no file involved).
5. Export: Markdown report to clipboard, full analysis JSON via a save dialog.

The app never writes to user files (ADR 0002). Reading is the whole
relationship with the user's disk; the only writes are settings/recents in
`userData` and explicit exports the user places via a save dialog.

## Screens and states, by name

- **Three-pane workspace** — Editor | Annotations | Analysis dashboard (design
  locked in the agent-demos tool, ported 1:1).
- **Empty state** — no text: open-file prompt + sample cards; dashboard
  placeholder.
- **Too-short state** — 1–29 words: countdown to the 30-word minimum.
- **File-open state** — file chip in the app bar (name + watch dot), editor
  buffer loaded, dashboard populated.
- **Edited state** — "edited" pill; watch dot greyed; external changes surface
  as the reload pill instead of silently replacing work.
- **File-error state** — binary / too large (>2 MB) / unreadable files get a
  human-readable toast with the reason; the current buffer is untouched.
- **Settings drawer** — searchable; audience, theme, annotation layers,
  thresholds; changelog with per-entry reset.
- **Cheat-sheet modal** — `?`; lists every shortcut including ⌘O / ⌘⇧R.

## Non-goals (whole features, cut cleanly)

- Saving edits back to disk. The app is a lens, not an editor.
- Batch/folder analysis, CLI mode, export formats beyond Markdown+JSON.
- Custom app icon (default Electron icon for 0.1).
