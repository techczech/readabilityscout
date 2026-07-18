# ADR 0002 — The app never writes to user files

Status: accepted (2026-07-18)

## Context

The app reads arbitrary files from anywhere on the user's disk. The trust
contract has to be obvious and total.

## Decision

- The only reads are the explicit open dialog, recents re-opens, and the
  `fs.watch` reload of the currently open file.
- The only writes are: the `userData` store (settings, settings changelog,
  recents) and exports the user explicitly places via a save dialog.
- There is no save-back, no autosave, no temp files next to the source. Edits
  in the buffer are scratch by definition ("edited" pill), matching the
  family precedent: the app touches nothing it wasn't explicitly told to.

## Consequences

- Guards at read time, with human-readable errors: folders rejected, >2 MB
  rejected, NUL-byte (binary) rejected, unreadable reported.
- External change handling: silent reload only while the buffer is unmodified;
  otherwise the reload pill. The app never overwrites local edits silently.
