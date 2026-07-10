# Stabilization Baseline

## Scope

This pass establishes a safer baseline for the app after the Journal composition work. It intentionally avoids schema changes and user-visible feature changes.

## Stabilized In This Pass

- Added Vitest scripts and pure logic tests for Journal style payloads, draft adapters, item sizing, and anchored popover placement.
- Centralized safe JSON parsing in `src/utils/safeJson.ts`.
- Centralized safe localStorage access in `src/utils/safeLocalStorage.ts`.
- Added reusable event and object URL hooks for later component cleanup.
- Moved Journal note/image/material style defaults into `journalItemStyles`.
- Moved image default sizing and item constraints into `journalItemSizing`.
- Moved existing-page-to-draft conversion and draft save diffing into `journalDraftAdapters`.
- Moved right-click popover placement into `journalPopoverPosition`.
- Reused those helpers from the create flow, composition edit flow, service layer, and viewer/editor item rendering paths.

## Current Risk Areas

- `JournalCreationFlow` and `JournalDraftCanvas` remain large components. They are now safer internally, but should still be split into drawer, setup, rail, canvas frame, and detail panel modules before adding more features.
- Journal viewing and composition editing now share more style logic, but their interaction shells are still separate.
- Large non-Journal files such as `NoteEditorPage`, `OshiIllustrationsPage`, `JournalHomePage`, and `translations.ts` should be reviewed in later passes.
- Media URL lifecycle should be migrated incrementally to `useObjectUrl` where components create browser object URLs.
- Window/document event listeners should be migrated incrementally to `useGlobalEvent` during component cleanup.

## Suggested Next Refactor Order

1. Split `JournalCreationFlow` into setup, rail, edge drawer, resource drawers, and review components.
2. Split `JournalDraftCanvas` into interaction hooks and visual renderers.
3. Share renderer components between view mode and composition edit mode.
4. Add targeted component tests or Playwright smoke tests only after the component boundaries are smaller.
