# ReadabilityScout

Electron app: readability analysis of any text file on disk. Scout family (`06_apps-utilities/01_desktop-apps/`).

- Read `docs/prd/PRD.md`, `docs/adr/`, `CONTEXT.md` before work. Never silently contradict an accepted ADR. Glossary terms are exact in UI copy and identifiers.
- Stack (locked, ADR 0001): Electron + electron-vite + React + TS, plain CSS ported 1:1 from the demo, lucide-react. bun; commit `bun.lock`.
- The app NEVER writes to user files (ADR 0002). Only writes: `userData` store + save-dialog exports.
- Visual design is locked in `agent-demos/kimi-k3-readability-test`; `src/renderer/src/styles.css` is a verbatim port + an additions block at the end. Change the design there first, then re-port.
- Engine: `src/renderer/src/analysis/engine.ts` is the TS port of the demo's `analysis.js` — keep the two documented deviations (stem+e fix; headings excluded). `wordlists.ts` / `samples.ts` are generated: `bun run build:data`.
- Engine invariants: `normaliseMarkdown` must stay length-preserving (offsets map to the original text); sentence/word metrics run only on normalised prose; Principles card shows computable signals only — no layout-level principles phoned in (ADR 0003).
- Gate-5 invariants on every edit: `?` cheat-sheet current with SHORTCUTS in `HelpModal.tsx`; every click target keyboard-reachable; settings changes logged with reset; British spelling; light identity, dark as option.
- Bump version every installed build.

## Verify

1. `bun run typecheck`.
2. `bun run test:smoke` — must print `"pass":true`.
3. Release builds: run per-platform with explicit arch — `bunx electron-builder --mac --arm64` and `bunx electron-builder --win --x64` as separate invocations. A combined `--mac --win --x64` cross-applies the arch flag and mislabels the dmg (learned at 0.2.0). Always `lipo -info` the mac binary before releasing.
