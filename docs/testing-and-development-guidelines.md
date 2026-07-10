# Testing And Development Guidelines

## Quality Gate

Use the full gate after framework, Journal, persistence, or shared utility changes:

```bash
pnpm quality
```

It currently runs:

```bash
pnpm lint && pnpm test && pnpm build
```

Use focused commands while iterating:

```bash
pnpm lint
pnpm test
pnpm test:watch
pnpm build
```

## What To Test

Prefer pure tests for logic that can run without the UI:

- safe JSON parsing and fallback behavior;
- Journal style payload parsing and serialization;
- Journal draft conversion and save diffing;
- item sizing and layout conversion;
- popover positioning and viewport clamping;
- preset and material mapping;
- tag parsing and other data-shape adapters.

Manual smoke tests are still required for:

- drag, resize, rotate, and stamp placement;
- image file loading through Tauri APIs;
- SQLite-backed create/save/reopen flows;
- overlays, drawers, modals, and animation timing;
- responsive layout and text overflow.

## Journal Architecture Rules

Journal currently has three user-facing states:

- home/gallery state for books and loose pages;
- view state for careful page review and light item adjustment;
- detailed composition edit state for page setup, resource drawers, item editing, and save.

Shared Journal logic should live under `src/features/journal/` when it:

- parses or creates `style_payload`;
- converts existing items to draft items;
- computes save plans;
- decides item sizing or constraints;
- computes popover positions;
- can be tested without React.

Component files should focus on orchestration and rendering.

## Shared Utility Rules

Use shared helpers instead of local one-off logic:

- `safeJsonParse` for unsafe JSON strings.
- `readLocalStorage` / `writeLocalStorage` for localStorage access.
- `useObjectUrl` when creating object URLs.
- `useGlobalEvent` when binding global DOM events.

Do not add new `JSON.parse` calls in render paths unless there is a narrow, documented reason.

## Current Known Risks

- `JournalCreationFlow` and `JournalDraftCanvas` are still large and should be split before adding major new Journal features.
- The production JS chunk is currently large enough for Vite to warn; route-level code splitting is a future performance task.
- View mode and detailed edit mode share more visual logic than before, but their interaction shells are still separate.
- Some large pages outside Journal still need later review: `NoteEditorPage`, `OshiIllustrationsPage`, `JournalHomePage`, and `translations.ts`.

## Suggested Next Refactor Order

1. Split `JournalCreationFlow` into setup, step rail, edge drawer, resource drawers, and review.
2. Split `JournalDraftCanvas` into item frame, renderers, detail panel, and pointer interaction hooks.
3. Share renderers between view mode and detailed edit mode.
4. Add targeted tests whenever shared pure logic changes.
5. Only after that, expand templates, material packs, and custom material import.
