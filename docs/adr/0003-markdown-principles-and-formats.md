# ADR 0003 — Markdown normalisation, readability principles, PDF/Word input

Status: accepted (2026-07-18)

## Context

Three gaps surfaced in real use: (1) markdown image syntax and URLs counted as
words and could form fake sentences (`![alt](url)caption`); (2) the analysis
covered formulas but not the user's own readability principles
(`07_webapps-websites/05_publications/readability-foundations`); (3) the app
only read plain text.

## Decisions

### 1. Length-preserving markdown blanking

`normaliseMarkdown` replaces non-prose markdown — image constructs (alt + URL),
link URLs (link text kept), bare URLs, HTML tags, reference-link definition
lines — with spaces of equal length, before any tokenisation. Metrics and
sentence segmentation run on the blanked text; display slices come from the
original at identical offsets, so the reader shows the raw text while marks
skip blanked regions. Rejected alternatives: deleting characters (breaks
offset mapping) and parsing markdown properly (dependency weight for no
measurable gain on prose files).

### 2. Principles card: only what is computable

From the five principles (space, chunks, guides, information structure, simple
language), the computable signals are:

- **Chunks** — heading density (target ≥ 1 per 5 paragraphs), list-item count,
  long comma sequences (≥4 commas, >20 words) as list candidates.
- **Information structure** — text opens with welcome/thanks (move to end).
- **Simple language** — nominalisation density (morphological suffix heuristic,
  target ≤ 5 per 100 words; calibrated 0.0 simple / 1.1 general / 6.5 academic /
  14.6 bureaucratic on the bundled samples), reader address ("you" count).
- **Space** and **guides** are layout-level for rendered documents; the app
  analyses plain text, so they are deliberately absent rather than phoned in.

These feed a Principles card and four new suggestion rules, in the established
priority order (structure → sentences → words).

### 3. PDF and Word input via extraction in main

`.docx` is unzipped in memory (fflate) and `word/document.xml` is flattened to
paragraphs. `.pdf` is parsed with pdfjs (via unpdf) and lines are rebuilt by
y-coordinate with x-gap spacing, since pdfjs runs carry no line structure;
words hyphenated at line ends are rejoined. Legacy `.doc` gets a human-readable
rejection. Extraction notes surface in the file chip and a toast. The source
file is only read, never written (ADR 0002 unchanged). Size limit 25 MB for
binary formats, 2 MB for plain text.
