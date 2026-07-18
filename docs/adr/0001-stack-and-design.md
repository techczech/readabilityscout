# ADR 0001 — Stack and design source

Status: accepted (2026-07-18)

## Context

Request: a simple Electron app wrapping the readability tool from
`agent-demos/kimi-k3-readability-test`, for any text file on disk, placed in
the scout app family at `06_apps-utilities/01_desktop-apps/`.

## Decisions

### 1. Stack: electron-vite + React + TS

Locked by family convention (qa-scout AGENTS.md: "Stack (locked by
convention): Electron + electron-vite + React + TS"; slidewell and todoscout
match). Dependency versions mirror slidewell's known-good set (Electron 42.4.0,
electron-vite 5.0.0, React 18). Package manager: bun (bun.lock committed).

### 2. Visual design: ported 1:1 from the demo

The demo's UI is the locked design — the user saw and approved it. Its CSS is
ported verbatim into `src/renderer/src/styles.css` (slidewell's plain-CSS
precedent; no Tailwind) with a small additions block for desktop chrome (file
chip, recents menu, pills, traffic-light inset). Gate-2 design rounds were
therefore unnecessary; redirect by editing this ADR and the demo first.

### 3. Analysis stays in the renderer

The engine is a TypeScript port of the demo's `analysis.js` (same two
documented deviations from the original Python). Word lists and samples are
generated from the demo by `scripts/build-data.mjs` — the demo folder is the
provenance source; re-run `bun run build:data` after it changes. Analysis per
keystroke is sub-millisecond at practical file sizes, so no IPC round-trip.

### 4. Icons: lucide-react

Real Lucide set per Gate 5, family standard (qa-scout).

### 5. Packaging

electron-builder config in package.json (slidewell pattern): dmg target,
`identity: null` (no signing), output in `release/`.
