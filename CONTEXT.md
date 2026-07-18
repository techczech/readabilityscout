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
- **Normalisation** — length-preserving blanking of markdown image syntax, link/bare URLs, HTML tags and reference definitions before tokenisation (ADR 0003). Offsets always refer to the original text.
- **Nominalisation** — a word of 7+ letters ending in a noun-forming suffix (`-tion`, `-ment`, `-isation`, …). Density per 100 words is the "verbs over nouns" signal; target ≤ 5.
- **Reader address** — count of "you/your/yours" forms; the "address the reader" signal.
- **Comma sequence** — a sentence with ≥4 commas and >20 words; a candidate for conversion to a list.
- **Extracted** — content pulled from a binary format (`pdf`, `docx`) rather than read as plain text; shown as a badge in the file chip. Layout is ignored.
