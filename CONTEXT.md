# ReadabilityScout — Glossary

Use these exact terms in PRD language, UI copy, and code identifiers. British spelling throughout.

- **Buffer** — the text currently in the editor pane, whatever its source. The unit of analysis.
- **Open file** — the file the buffer was loaded from, shown as the **file chip** in the app bar. Cleared by loading a sample or clearing.
- **Watch dot** — the dot in the file chip: green = following changes on disk, grey = the buffer has been **edited** locally.
- **Edited** — the buffer diverges from the open file (pill in the editor status bar). External changes then surface as the **reload pill** instead of silently replacing the buffer.
- **Reload pill** — the "changed on disk — reload" affordance in the editor status bar. The only recovery path; the app never overwrites edits silently.
- **Scratch** — a buffer with no open file (typed/pasted, or a sample).
- **Recents** — the last 12 opened files, persisted in `userData/recent-files.json`, shown in the app-bar menu.
- **Familiar word / Unfamiliar word / AWL word** — as in the analysis engine (`isFamiliar`, `isAcademic`); see agent-demos `kimi-k3-readability-test/CONTEXT.md`.
- **Grade consensus / Sentence rhythm / Annotation layer / Audience target** — as in the demo glossary; same UI, same terms.
- **userData store** — `settings.json`, `settings-changelog.json`, `recent-files.json` under Electron's `userData` path. The only files the app writes unprompted.
