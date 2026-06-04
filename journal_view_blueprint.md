# OshiNote Journal View Blueprint

> Goal: turn note browsing into a scrapbook-like memory page without turning OshiNote into a heavy design tool.

This document merges three inputs:

- the current OshiNote product shape: oshi -> archive -> notes
- the proposed "sticker journal" direction
- the prototype image's strongest ideas, with unnecessary tool complexity trimmed down

The first implementation should feel like opening a personal oshi memory notebook: notes are still the source of truth, but they can be arranged, styled, and edited directly on a page.

---

## 1. Product Direction

### Core Idea

Add a fourth note display mode:

```ts
type ViewMode = 'card' | 'list' | 'graph' | 'journal'
```

In `journal` mode, the active archive is shown as scrapbook pages. Each note appears as a draggable sticker-like card. Clicking a sticker opens inline editing or a side inspector inside the same workspace instead of navigating away to the full note editor route.

### Design Positioning

The journal view should be:

- a memory notebook
- a cozy arranging surface
- a more emotional way to revisit notes
- compatible with the existing note model

It should not become:

- a full Figma-like design canvas
- a general-purpose whiteboard
- a heavy publishing/layout editor
- a replacement for the normal note editor in the first version

---

## 2. Prototype Takeaways

### Keep

| Prototype Element | Decision | Reason |
| --- | --- | --- |
| Double-page notebook canvas | Keep, but support single-page layout first if needed | Strong scrapbook identity and natural archive/page metaphor |
| Sticker-like note cards | Keep | This is the core experience |
| Drag, resize, rotate | Keep in MVP | Makes the page feel personal and spatial |
| Click sticker to edit in-place | Keep | Avoids breaking immersion by routing to a separate page |
| Page thumbnails / page management | Keep | Fits "notebook" mental model better than infinite canvas |
| Tape, pin, heart, flower decorations | Keep as later limited material presets | Adds warmth, but should not dominate first release |
| Multiple view modes | Keep | Matches current `card/list/graph` architecture |
| Background / cover themes | Keep later | Useful for emotional personalization |

### Simplify

| Prototype Element | Decision | Reason |
| --- | --- | --- |
| Full vertical design toolbar | Reduce | Too close to a design app; first version should be note-first |
| Independent shapes/text objects | Defer | Adds multiple object types too early |
| Large always-visible AI panel | Move into selected-note panel | AI is useful, but not the main journal surface |
| Full material library | Defer | Start with a small curated set |
| Complex layer management | Defer | Use simple bring forward/send backward controls first |
| Dense decorative default pages | Reduce | Real note pages need readability and long-term comfort |

---

## 3. Feature Plan

### MVP: Journal View Foundation

| Feature | Priority | User Value | Implementation Notes |
| --- | --- | --- | --- |
| Add `journal` view mode | P0 | User can enter the scrapbook experience | Extend `ViewMode`, store setter, toolbar button in `OshiDetailPage` |
| Journal page data model | P0 | Layout persists per archive | Add `journal_pages` and `journal_items` migrations |
| Auto-create first page | P0 | No empty setup burden | When opening an archive with no journal page, create page 1 |
| Render note stickers | P0 | Notes become page objects | `JournalPageView` renders `JournalSticker` for each `journal_item` |
| Auto-place existing notes | P0 | Existing archives immediately work | Create journal items for unplaced notes using a simple grid/randomized layout |
| Drag to move | P0 | Core personalization | Use DOM positioning; save `x/y` after drag end |
| Resize sticker | P0 | Users can create hierarchy | Save `width/height`; clamp to page bounds |
| Rotate sticker | P1 | Adds handmade feeling | Save `rotation`; use small rotate handle or inspector input |
| Select sticker | P0 | Enables editing and styling | Store selected item id locally in `JournalPageView` |
| Inline inspector panel | P0 | Edit without route jump | Right side panel shows note metadata, style, actions |
| Edit note content from panel | P0 | Keeps flow in same page | Reuse `TipTapEditor` or a compact editor wrapper |
| Save layout changes | P0 | Page arrangement is durable | `journalService.updateJournalItemLayout` |
| Page thumbnails | P1 | Navigate journal pages | Horizontal or side thumbnail strip |
| Add page | P1 | Expand scrapbook | `createJournalPage(archiveId)` with next page index |

### Version 1.1: Visual Personality

| Feature | Priority | User Value | Implementation Notes |
| --- | --- | --- | --- |
| Sticker style presets | P1 | More scrapbook feeling | `sticky`, `memo`, `polaroid`, `ticket`, `lace` |
| Sticker color presets | P1 | Fast visual grouping | Store `color` on `journal_items` |
| Border variants | P1 | Handmade variation | Store `border_style`; map to CSS classes |
| Favorite corner badge | P1 | Emotional signal | Use existing `note.favorite` |
| Tag chips as mini stickers | P1 | Visual search cues | Render first 3 tags on sticker |
| Page background presets | P1 | Themed pages | Store background id/color on `journal_pages` |
| Bring forward / send backward | P1 | Basic layer control | Update `z_index` |
| Reset/auto-arrange page | P1 | Recover messy layouts | Recalculate positions for current page |

### Version 1.2: Materials and Media

| Feature | Priority | User Value | Implementation Notes |
| --- | --- | --- | --- |
| Image stickers | P2 | Add screenshots/fanart/moments | Add `journal_assets` or allow `journal_items` with `item_type = 'image'` |
| Decorative stickers | P2 | Tape, pins, hearts, flowers | Use a small built-in asset set first |
| Polaroid note style with image | P2 | Matches prototype strongly | Note sticker can render first embedded image or chosen cover image |
| Page cover | P2 | Notebook identity | Add cover page metadata or special page type |
| Export page as image | P2 | Share or archive page | Use DOM-to-image/html2canvas later; not first MVP |

### Later: Advanced Notebook

| Feature | Priority | User Value | Implementation Notes |
| --- | --- | --- | --- |
| Double-page spread mode | P2 | Strong book feeling | Render two `journal_pages` side by side |
| Timeline auto-pages | P2 | Create pages by date/event | Generate pages by month, stream, tag, or archive |
| Journal search overlay | P2 | Find notes without leaving view | Reuse existing search store |
| AI tools in inspector | P2 | Translate/refine selected note | Reuse existing AI services inside selected-note panel |
| Multi-select | P3 | Power user layout edits | Only after single-item interactions feel stable |
| Free text/shape objects | P3 | More design freedom | Add only if real user need appears |

---

## 4. First-Version UX Blueprint

### 4.1 Entry Point

Add a new icon button in the existing note toolbar:

- card view
- list view
- graph view
- journal view

Suggested icon: `NotebookTabs`, `BookOpen`, or `PanelTop`.

When `viewMode === 'journal'`, the content area renders `JournalPageView` instead of the existing grid/list/graph content.

### 4.2 Main Layout

```txt
OshiDetailPage
|-- existing header
|-- existing archive/search/view toolbar
`-- Journal workspace
    |-- page canvas
    |-- optional selected-item inspector
    `-- optional page thumbnail strip
```

MVP layout:

```txt
+-------------------------------------------------------+
| Toolbar: Page 1 | Add Page | Auto Arrange | Zoom      |
+---------------------------------------+---------------+
|                                       | Inspector     |
|          JournalCanvas                | when selected |
|                                       |               |
+---------------------------------------+---------------+
| Page thumbnails / P.1 P.2 P.3                         |
+-------------------------------------------------------+
```

### 4.3 Sticker Behavior

Each note sticker should show:

- title
- 2-4 lines of plain text preview
- created date
- first 3 tags
- favorite badge if starred

Interactions:

- click: select sticker
- double click or edit button: open compact content editor in inspector
- drag: move sticker
- resize handle: resize sticker
- rotate handle or inspector slider: rotate sticker
- delete/remove from page: removes journal item only, not the note, unless explicitly using note delete action

Important distinction:

- "Remove from page" means the note still exists in the archive.
- "Delete note" means the actual note is deleted and should stay behind a confirmation.

### 4.4 Inspector Panel

When no sticker is selected:

- page title
- background preset
- add unplaced notes
- auto-arrange page
- page navigation

When a sticker is selected:

- note title
- favorite toggle
- sticker style preset
- color preset
- size controls
- rotation control
- layer controls
- edit content button
- open full editor button as fallback

When editing:

- compact `TipTapEditor`
- save/cancel controls
- tags/date/archive controls can remain simplified in MVP

---

## 5. Data Model Blueprint

### 5.1 Types

Add to `src/types/index.ts`:

```ts
export type JournalStickerStyle = 'sticky' | 'memo' | 'polaroid' | 'ticket' | 'lace'
export type JournalItemType = 'note'

export interface JournalPage {
  id: string
  archive_id: string
  title: string
  page_index: number
  background: string
  created_at: string
  updated_at: string
}

export interface JournalItem {
  id: string
  page_id: string
  note_id: string
  item_type: JournalItemType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  z_index: number
  sticker_style: JournalStickerStyle
  color: string | null
  border_style: string | null
  created_at: string
  updated_at: string
}

export interface JournalItemWithNote extends JournalItem {
  note: Note
}
```

Later versions can extend `JournalItemType`:

```ts
type JournalItemType = 'note' | 'image' | 'text' | 'decoration'
```

Do not add those item types in MVP unless necessary.

### 5.2 SQLite Migrations

Add tables:

```sql
CREATE TABLE IF NOT EXISTS journal_pages (
  id         TEXT PRIMARY KEY,
  archive_id TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  page_index INTEGER NOT NULL DEFAULT 0,
  background TEXT NOT NULL DEFAULT 'paper',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (archive_id) REFERENCES archives(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS journal_items (
  id            TEXT PRIMARY KEY,
  page_id       TEXT NOT NULL,
  note_id       TEXT NOT NULL,
  item_type     TEXT NOT NULL DEFAULT 'note',
  x             REAL NOT NULL DEFAULT 0,
  y             REAL NOT NULL DEFAULT 0,
  width         REAL NOT NULL DEFAULT 240,
  height        REAL NOT NULL DEFAULT 180,
  rotation      REAL NOT NULL DEFAULT 0,
  z_index       INTEGER NOT NULL DEFAULT 0,
  sticker_style TEXT NOT NULL DEFAULT 'sticky',
  color         TEXT,
  border_style  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (page_id) REFERENCES journal_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_journal_pages_archive ON journal_pages(archive_id);
CREATE INDEX IF NOT EXISTS idx_journal_items_page ON journal_items(page_id);
CREATE INDEX IF NOT EXISTS idx_journal_items_note ON journal_items(note_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_items_page_note ON journal_items(page_id, note_id);
```

### 5.3 Service Layer

Create:

```txt
src/features/journal/journalService.ts
```

Suggested API:

```ts
fetchJournalPages(archiveId: string): Promise<JournalPage[]>
ensureJournalPage(archiveId: string): Promise<JournalPage>
createJournalPage(archiveId: string, title?: string): Promise<JournalPage>
updateJournalPage(id: string, input: Partial<Pick<JournalPage, 'title' | 'background'>>): Promise<void>
deleteJournalPage(id: string): Promise<void>

fetchJournalItems(pageId: string): Promise<JournalItemWithNote[]>
ensureJournalItemsForNotes(pageId: string, notes: Note[]): Promise<void>
createJournalItemForNote(pageId: string, noteId: string, layout?: Partial<JournalItem>): Promise<JournalItem>
updateJournalItemLayout(id: string, input: Pick<JournalItem, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'z_index'>): Promise<void>
updateJournalItemStyle(id: string, input: Pick<JournalItem, 'sticker_style' | 'color' | 'border_style'>): Promise<void>
removeJournalItem(id: string): Promise<void>
```

### 5.4 Store Layer

Create:

```txt
src/stores/journalStore.ts
```

State:

```ts
interface JournalState {
  pages: JournalPage[]
  activePageId: string | null
  items: JournalItemWithNote[]
  loading: boolean
  error: string | null

  loadArchiveJournal: (archiveId: string, notes: Note[]) => Promise<void>
  setActivePage: (pageId: string) => Promise<void>
  createPage: (archiveId: string) => Promise<void>
  updateItemLayout: (itemId: string, layout: LayoutInput) => Promise<void>
  updateItemStyle: (itemId: string, style: StyleInput) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
}
```

Keep note editing in `noteStore` where possible. The journal store should manage layout, pages, and selected page state, not replace note CRUD.

---

## 6. Component Blueprint

Create folder:

```txt
src/components/features/journal/
```

### Components

| Component | Responsibility |
| --- | --- |
| `JournalPageView.tsx` | Top-level view for one archive's journal mode |
| `JournalCanvas.tsx` | Page surface, zoom, background, item rendering |
| `JournalSticker.tsx` | One draggable/resizable note sticker |
| `JournalInspector.tsx` | Selected item/page editing panel |
| `JournalPageStrip.tsx` | Page thumbnails and add-page control |
| `JournalToolbar.tsx` | Page actions, zoom, auto-arrange |
| `InlineNoteEditor.tsx` | Compact editor wrapper around `TipTapEditor` |

### Suggested File Layout

```txt
src/
  components/
    features/
      journal/
        JournalPageView.tsx
        JournalCanvas.tsx
        JournalSticker.tsx
        JournalInspector.tsx
        JournalPageStrip.tsx
        JournalToolbar.tsx
        InlineNoteEditor.tsx
  features/
    journal/
      journalService.ts
      journalLayout.ts
  stores/
    journalStore.ts
```

### Layout Helper

Create:

```txt
src/features/journal/journalLayout.ts
```

Responsibilities:

- generate initial positions for existing notes
- clamp stickers inside the page
- create slight default rotations
- auto-arrange current page

Example constants:

```ts
export const JOURNAL_PAGE = {
  width: 960,
  height: 680,
  padding: 32,
}

export const DEFAULT_STICKER = {
  width: 240,
  height: 180,
}
```

---

## 7. Interaction Implementation Notes

### Drag / Resize

Preferred MVP approach:

- use DOM elements with absolute positioning
- add a small dependency like `react-rnd` for drag and resize
- store layout only on drag/resize end, not every pointer movement

Reason:

- note stickers contain real HTML text, tags, controls, and later editor previews
- DOM is easier than canvas for accessible text and existing React components
- `react-rnd` is enough for first version

If avoiding a new dependency, implement simple pointer drag manually first and defer resize. But the full target experience benefits from a library.

### Rotation

MVP can use inspector controls:

- small stepper buttons: -5 deg / +5 deg
- reset rotation

Later:

- rotate handle on selected sticker

### Saving

Use debounce or end-event saves:

- drag stop -> save `x/y`
- resize stop -> save `width/height`
- rotation change -> save `rotation`
- style change -> save immediately

Avoid saving on every pixel movement.

### Bounds

First version should clamp stickers inside the page. This prevents lost notes and makes page export easier later.

### Zoom

MVP can start without zoom if page fits. If zoom is added:

- store zoom only in component state
- do not store zoom in database
- page coordinates remain in canonical page units

---

## 8. Visual Design Blueprint

### Page Surface

Use a paper-like full-width work area:

- off-white or theme-aware paper color
- subtle dot grid or faint ruled texture
- thin border
- small page number
- enough padding for stickers

Avoid overly saturated backgrounds by default.

### Sticker Styles

MVP style presets:

| Style | Visual |
| --- | --- |
| `sticky` | soft colored note, slight shadow |
| `memo` | ruled/grid paper |
| `polaroid` | image-like frame, good for future media |
| `ticket` | compact ticket/card shape |
| `lace` | round or scalloped ASMR-style sticker, can be later |

First implementation can include only:

- `sticky`
- `memo`
- `ticket`

### Decoration Policy

Decorations should support memories, not hide them.

Default pages should be readable. Decorative elements should be:

- optional
- small
- finite in MVP
- theme-aware where possible

---

## 9. Integration With Existing Code

### `src/types/index.ts`

Add:

- `ViewMode` includes `journal`
- journal page/item interfaces
- journal style types

### `src/stores/noteStore.ts`

No major changes besides accepting `journal` as `ViewMode`.

### `src/pages/OshiDetailPage.tsx`

Changes:

- add journal icon button to view switcher
- render `JournalPageView` when `viewMode === 'journal'`
- pass `oshiId`, `activeArchiveId`, and `notes`
- preserve existing card/list/graph behavior

### `src/database/migrations.ts`

Add journal migrations at the end.

### Existing Note Editor

Keep `NoteEditorPage` for full editing.

Journal inline editing should reuse:

- `TipTapEditor`
- `fetchNoteById`
- `updateNote`
- tag/date controls later if needed

---

## 10. Development Phases

### Phase A: Data and Empty View

- [ ] Add journal types
- [ ] Add SQLite migrations
- [ ] Create `journalService`
- [ ] Create `journalStore`
- [ ] Add `journal` view mode button
- [ ] Render an empty journal page for active archive

Success criteria:

- switching to journal view does not break existing views
- first journal page auto-creates for an archive

### Phase B: Stickers and Layout Persistence

- [ ] Auto-create journal items for current archive notes
- [ ] Render stickers on page
- [ ] Implement select state
- [ ] Implement drag movement
- [ ] Save sticker positions
- [ ] Add simple auto-arrange

Success criteria:

- existing notes appear as stickers
- moving a sticker persists after leaving and returning

### Phase C: Inspector and Inline Editing

- [ ] Add inspector panel
- [ ] Show selected note data
- [ ] Add sticker style/color controls
- [ ] Add favorite toggle
- [ ] Add compact note editor
- [ ] Save note edits and refresh sticker preview

Success criteria:

- user can click a sticker, edit its content, and stay in journal mode

### Phase D: Page Management

- [ ] Add page strip
- [ ] Add create page
- [ ] Add page title/background
- [ ] Add unplaced notes panel
- [ ] Add remove-from-page action

Success criteria:

- archive can contain multiple journal pages
- notes can be arranged across pages without deleting note data

### Phase E: Polish

- [ ] Add theme-aware paper backgrounds
- [ ] Add sticker preset visuals
- [ ] Add resize
- [ ] Add rotation controls
- [ ] Add layer controls
- [ ] Add empty states and loading states
- [ ] Verify desktop and smaller viewport behavior

Success criteria:

- the feature feels intentional, cozy, and stable enough for daily use

---

## 11. Explicit Non-Goals For First Implementation

Do not build these in the first pass:

- independent free-shape drawing
- full material marketplace/library
- multi-select object editing
- complex layer panel
- image export
- double-page spread if single-page layout is not stable yet
- timeline generation
- AI panel always visible on the journal page
- free text objects separate from notes

These are good future features, but they should not block the core notebook experience.

---

## 12. Recommended First Commit Scope

The first implementation commit should be small and structural:

- add journal database tables
- add journal types
- add journal service/store skeleton
- add journal view button
- render a simple paper page with current notes auto-placed as static stickers

After that, add interaction in separate commits:

1. drag/save
2. selection/inspector
3. inline editing
4. pages
5. style polish

This keeps the work reviewable and makes regressions easier to isolate.

---

## 13. Design Summary

The journal view should absorb the prototype's emotional strengths:

- scrapbook page
- draggable note stickers
- page thumbnails
- soft handmade visuals
- in-place editing

But it should reject or defer the prototype's heavy design-tool instincts:

- too many object tools
- large permanent AI panel
- full freeform material editing
- complex layers

The right first version is:

> A cozy, persistent scrapbook view for existing notes.

Not:

> A general-purpose canvas editor.

---

## 14. Revision Plan After First Prototype Review

The first implemented journal/sidebar prototype exposed several product and data-model issues. The following plan should guide the next implementation batches.

### Batch 1: Navigation And Archive Safety

Immediate fixes:

- Sidebar collapsed state should not show a squeezed chevron button.
- In collapsed state, clicking the app logo should expand the sidebar.
- The current `Add` button under an oshi is actually an archive/category action, so it should be renamed to `+ Archive` or `+ Category`.
- Archive deletion should explain how many notes are inside the archive before destructive action.
- Archive deletion should keep note counts and visible note lists consistent after the operation.

Implementation notes:

- Keep the sidebar information architecture:
  - My Oshis
  - Oshi Space
  - Tools
- Keep archive management inside the oshi detail header for now, but make the label explicit.
- Later, consider moving archive/category management into a compact dropdown or settings popover.

### Batch 2: Journal Should Be Manual Placement, Not Auto-Filled

Change the journal behavior:

- A new journal page should start empty.
- Existing notes should not be automatically placed on the page.
- Add an `Add Note` / `Place Note` action in journal mode.
- This action opens a searchable picker of notes from the active archive or oshi.
- The user selects notes and places them on the finite page canvas.
- Notes can exist without being placed on any journal page.

Implementation notes:

- Keep `journal_pages` and `journal_items`.
- Remove automatic `ensureJournalItemsForNotes` calls from normal page loading.
- Keep a service method for optional auto-arrange/debug, but do not call it by default.
- Add a query for unplaced notes for the active journal page.

### Batch 3: Journal Editing Should Be Popover-Based

Replace the right-side inspector with a contextual sticker popover:

- The canvas should be the dominant surface.
- Selecting a sticker opens a small popover near the sticker.
- The popover should support:
  - edit title/content
  - style preset
  - color
  - size controls
  - rotation controls
  - bring forward
  - open full editor
  - remove from page
- The popover should not permanently occupy horizontal canvas space.

Implementation notes:

- Keep full note editing route as fallback.
- Use the compact TipTap editor only when the user clicks `Edit`.
- Avoid making the popover too tall; advanced options can be folded.

### Batch 4: Independent Notes Page

Add a first-class Notes page:

- Users can browse all notes independent of a selected oshi.
- Creating a note from an oshi page automatically assigns that oshi.
- Creating a note from the global Notes page can start without an oshi or ask for assignment.
- The editor should expose ownership/assignment controls.

Implementation notes:

- In the short term, keep one primary `oshi_id` on `notes`.
- Add UI language around "Assigned Oshi" instead of implying the note only exists inside one archive.

### Batch 5: Multi-Oshi Ownership Model

Future data-model evolution:

```sql
CREATE TABLE note_oshi_links (
  note_id TEXT NOT NULL,
  oshi_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'related',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  PRIMARY KEY (note_id, oshi_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (oshi_id) REFERENCES oshis(id) ON DELETE CASCADE
);
```

Possible roles:

- `primary`
- `collab`
- `mentioned`
- `related`

Do not rush this until the independent Notes page exists. Multi-oshi ownership affects:

- search
- note counts
- oshi detail pages
- archive semantics
- exports
- journal note picker

### Batch 6: Sticker Templates And Media-Aware Cards

Future journal template system:

```ts
type JournalStickerTemplate =
  | 'text'
  | 'image-cover'
  | 'polaroid'
  | 'quote'
  | 'ticket'
```

Behavior:

- If a note contains an image, `image-cover` or `polaroid` can use it as the visual focus.
- If no image exists, fall back to text preview.
- The template field should be stored on `journal_items` later, separate from `sticker_style`.

This should remain a later polish task, not a blocker for manual journal placement.

---

## 15. Detailed Next Blueprint: Notes Ownership And Journal Templates

Date: 2026-06-04

This section expands the next two recommended product tracks:

1. complete the global Notes and editor ownership model
2. build a template system for journal books, pages, and stickers

The intent is to make OshiNote's data foundation stronger before adding heavier AI or media features. Notes should become easy to find, assign, sort, and reuse. Journal should become visually expressive through curated templates rather than a freeform design-tool surface.

---

## 15.1 Global Notes And Editor Ownership Management

### Product Purpose

The global Notes area should become the user's complete memory library, independent of any single oshi page. It should answer:

- What have I written?
- Which notes still need sorting?
- Which oshi, archive, and tags does this note belong to?
- Can I reorganize notes without losing context?

The editor should make ownership explicit. A note is not merely "inside an archive"; it is assigned to an oshi, optionally filed into an archive, and tagged for later retrieval. This language prepares the product for future multi-oshi notes without forcing that data model too early.

### UX Design

#### Global Notes Page

The global Notes page should feel like a calm library view, not a feed. It should support scanning, filtering, and maintenance.

Primary regions:

- Header:
  - `All Notes`
  - total note count
  - `New Note` button
- Search and filters:
  - text search
  - oshi filter
  - archive filter
  - tag filter
  - ownership status filter
  - favorite-only toggle
  - sort order
- Results:
  - card view for browsing
  - list view for maintenance
  - compact metadata: assigned oshi, archive, tags, favorite, created/updated date
- Empty states:
  - no notes
  - no search matches
  - no unassigned notes
  - no unfiled notes

#### Note Editor Ownership Panel

The note editor should feel like a writing surface, not a form. Keep the existing global sidebar/app shell and redesign the editor interior around two regions:

- Main writing area:
  - back navigation, note title, favorite/delete/save actions
  - a compact metadata summary under the title
  - optional image preview/attachment strip as part of the note body area
  - the rich-text editor as the primary surface
- Right-side metadata panel:
  - note details
  - tags
  - attachments

This keeps the emotional task of writing a stream memory in the center, while ownership and maintenance fields stay available without turning the page into stacked horizontal form rows.

Controls:

- Assigned Oshi selector
- Archive selector filtered by the selected oshi
- Source/stream URL
- Tags input/editor
- Favorite toggle
- Created date editor
- Attachment image add/remove
- Status hint:
  - `Assigned to <Oshi>`
  - `Unassigned`
  - `Unfiled`
  - `Needs sorting`

Behavior:

- Creating from an oshi page should prefill `oshi_id`.
- Creating from an archive should prefill both `oshi_id` and `archive_id`.
- Creating from global Notes should allow no oshi at first, but visually mark the note as `Unassigned`.
- Changing assigned oshi should reset archive if the old archive belongs to another oshi.
- Archive selector should be disabled until an oshi is selected.
- Archive quick-create should be available beside the archive selector and select the new archive after creation.
- Source URLs should normalize `example.com` to `https://example.com` for opening, while preserving the user's saved text.
- Images should no longer sit between two full-width toolbar rows; they should appear as note attachments or an optional visual lead-in.
- The editor should save ownership changes together with note content.
- On narrower layouts, the right metadata panel should collapse below the editor or become a single-column stacked layout.

### Data Model

Short-term model:

```ts
interface Note {
  oshi_id: string | null
  archive_id: string | null
  source_url: string
  tags: string[]
}
```

Keep one primary `oshi_id` for now. Use UI language `Assigned Oshi` instead of implying permanent single ownership.

Derived statuses:

```ts
type NoteOwnershipStatus =
  | 'assigned'
  | 'unassigned'
  | 'unfiled'
  | 'untagged'
  | 'needs-sorting'
```

Rules:

- `unassigned`: `oshi_id === null`
- `unfiled`: `oshi_id !== null && archive_id === null`
- `untagged`: `tags.length === 0`
- `needs-sorting`: any of unassigned, unfiled, or untagged

Future model:

```sql
CREATE TABLE note_oshi_links (
  note_id TEXT NOT NULL,
  oshi_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'related',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  PRIMARY KEY (note_id, oshi_id)
);
```

Do not implement this until the single-owner UI is stable.

### Functional List

| Feature | Priority | Description | Acceptance Criteria |
| --- | --- | --- | --- |
| Global notes browse | P0 | Browse all notes independent of oshi | `/notes` lists assigned and unassigned notes |
| Ownership filters | P0 | Filter by oshi, archive, tag, status | Filters combine predictably and reset pagination |
| Global note creation | P0 | Create a note from All Notes | New note can start unassigned |
| Editor ownership panel | P0 | Edit assigned oshi/archive/tags in editor | Changes persist and are reflected in lists |
| Archive validation | P0 | Prevent mismatched archive/oshi state | Changing oshi clears incompatible archive |
| Needs sorting view | P1 | One-click maintenance filter | Shows unassigned, unfiled, or untagged notes |
| Bulk maintenance | P1 | Select multiple notes and assign/tag | Can assign oshi/archive/tags to selected notes |
| Recently updated sort | P1 | Sort by update time | Updated notes rise correctly |
| Ownership badges | P1 | Visual status chips on cards/list rows | Users can see `Unassigned`/`Unfiled` quickly |
| Editor creation context | P1 | Route carries initial oshi/archive | Creating from oshi/archive preselects ownership |
| Archive quick create | P2 | Create archive from editor selector | New archive is assigned and selected |
| Source URL | P2 | Save and open the stream/source URL for a note | Saved note can open the URL externally |
| Right metadata panel | P2 | Move details/tags/attachments out of the writing flow | Editor reads as document-first instead of form-first |
| Multi-oshi preparation | P2 | Keep copy language and service boundaries ready | No code assumes notes can only matter to one oshi forever |

### Implementation Plan

| Batch | Scope | Files / Modules | Notes |
| --- | --- | --- | --- |
| N1 | Audit current note routes and service methods | `NotesPage`, `NoteEditorPage`, `noteService`, `noteStore` | Confirm which global flows already work |
| N2 | Add editor ownership panel | `NoteEditorPage`, `OshiForm`-like selectors, archive service | Start with simple selects, not a complex popover |
| N3 | Validate oshi/archive transitions | `noteService`, editor save handler | Clear archive on incompatible oshi change |
| N4 | Polish global Notes filters and badges | `NotesPage`, note list/card components | Make maintenance states visible |
| N5 | Add route-aware creation defaults | route params/query state | From oshi/archive pages, prefill assignment |
| N6 | Add bulk maintenance | new selection state in `NotesPage` | Only after single-note editing feels stable |
| N7 | Redesign note editor interior | `NoteEditorPage`, optional editor toolbar styling | Use main writing area plus right metadata panel within the existing sidebar shell |

### Deferred Note Editor Enhancements

These are useful, but are not required for the recommended editor redesign:

| Module | Purpose | Likely Data / Implementation |
| --- | --- | --- |
| Cover image | Let one attachment become the note's visual lead image | Use first attachment by default first; later add `cover_image_id` or image role |
| Timeline links | Save stream timestamp links as clickable favorite moments | Parse YouTube/Bilibili timestamp URLs, store as lightweight timeline items when needed |
| Attachment management | Sort images, choose cover, support richer asset types | Extend `note_images` or introduce `note_assets` |
| Emotion chips | Separate mood/emotion labels from ordinary tags | Add only if ordinary tags become too overloaded |
| Note templates | Pre-fill common stream recap structures | Add after repeated writing patterns are clear |

### Risks

- Archive semantics can become confusing if users think deleting an archive deletes notes.
- Global creation without oshi needs gentle empty-state language.
- Multi-oshi links should not be introduced before the UI language is stable.
- Bulk edit can create accidental destructive changes; keep it behind explicit selection and confirmation.

---

## 15.2 Journal Template System

### Product Purpose

Journal should let users create beautiful memory books without turning OshiNote into a design app. Templates should provide visual personality through curated choices:

- book cover templates
- page background templates
- sticker templates
- optional page layout templates

The user should feel they are choosing a notebook style, not manually designing every pixel.

### Template Principles

- Templates are curated and finite.
- Templates should be theme-aware where they touch app chrome.
- Book/page/sticker templates should be independent layers.
- Templates should be editable through simple controls.
- A template should never hide the note as the source of truth.

Non-goals:

- freeform shape drawing
- arbitrary layer panels
- drag-and-drop decorative asset marketplace
- full publishing layout editor

### Template Types

#### Book Cover Templates

Current direction:

```ts
type JournalCoverStyle =
  | 'classic'
  | 'cloth'
  | 'paper'
  | 'night'
  | 'postcard'
  | 'minimal'

type JournalCoverDecoration =
  | 'none'
  | 'flower'
  | 'moon'
  | 'heart'
  | 'camera'
  | 'ticket'
```

Fields:

- title
- description
- date label
- cover color
- cover style
- cover decoration

Future fields:

- cover texture strength
- title placement preset
- optional small subtitle
- template id for reusable presets

#### Page Templates

```ts
type JournalPageTemplate =
  | 'blank-paper'
  | 'soft-grid'
  | 'memo-lines'
  | 'photo-board'
  | 'event-recap'
  | 'monthly-memory'
```

Fields:

- background id
- default item layout strategy
- optional page title style
- optional decorative corner marks

Behavior:

- Applying a page template to an empty page sets background and layout defaults.
- Applying to a page with items should ask:
  - keep current sticker positions
  - rearrange using template layout
  - cancel

#### Sticker Templates

```ts
type JournalStickerTemplate =
  | 'text'
  | 'memo'
  | 'ticket'
  | 'quote'
  | 'polaroid'
  | 'image-cover'
```

Fields:

- template
- color
- border style
- size preset
- optional image mode

Behavior:

- `text`: readable default note sticker
- `memo`: lined paper style for longer text
- `ticket`: compact event/date style
- `quote`: emphasizes a short excerpt
- `polaroid`: image-first card with caption
- `image-cover`: uses first note image as cover if available

If a note has no image, image-based templates should gracefully fall back to text.

#### Layout Templates

```ts
type JournalLayoutTemplate =
  | 'free'
  | 'two-column'
  | 'hero-and-notes'
  | 'scattered'
  | 'timeline'
```

Behavior:

- `free`: current manual placement
- `two-column`: neat reading layout
- `hero-and-notes`: one large sticker plus supporting notes
- `scattered`: scrapbook-style randomized rotation and position
- `timeline`: vertical date-based placement

Layout templates should be optional helpers. Users must still be able to manually move stickers after applying them.

### Functional List

| Feature | Priority | Description | Acceptance Criteria |
| --- | --- | --- | --- |
| Cover template gallery | P0 | Choose cover style/color/decoration | Existing books can update cover template |
| Theme-aware bookshelf UI | P0 | Journal chrome follows app skin | Dark and light skins do not clash |
| Page background templates | P0 | Choose paper/grid/color backgrounds | Page background persists |
| Sticker template field | P1 | Store template separately from style | Existing stickers migrate to `text`/`memo` safely |
| Sticker template picker | P1 | Select text/memo/ticket/quote | Popover updates selected sticker |
| Page template picker | P1 | Apply blank/grid/memo/photo-board templates | Empty page changes immediately |
| Layout helper | P1 | Apply optional page layout | Existing items can be rearranged after confirmation |
| Template preview cards | P1 | Show visual previews before applying | User can compare templates quickly |
| Template-aware note picker | P2 | Choose template while placing a note | New sticker can be placed as ticket/polaroid/etc. |
| Media-aware sticker cards | P2 | Use note images in polaroid/image-cover | Falls back to text if no image |
| Template duplication | P2 | Duplicate page/book style | Useful style can be reused |
| Export current page image | P3 | Share scrapbook page | Only after visual system stabilizes |

### Data Model

Near-term additions:

```sql
ALTER TABLE journal_items ADD COLUMN sticker_template TEXT NOT NULL DEFAULT 'text';
ALTER TABLE journal_pages ADD COLUMN page_template TEXT NOT NULL DEFAULT 'blank-paper';
ALTER TABLE journal_pages ADD COLUMN layout_template TEXT NOT NULL DEFAULT 'free';
```

TypeScript:

```ts
interface JournalPage {
  background: string
  page_template: JournalPageTemplate
  layout_template: JournalLayoutTemplate
}

interface JournalItem {
  sticker_style: JournalStickerStyle
  sticker_template: JournalStickerTemplate
  color: string | null
  border_style: string | null
}
```

Keep `sticker_style` for current visual compatibility, but gradually shift semantic template choice into `sticker_template`.

### UX Design

#### Book Template Editing

Use a centered modal or popover with:

- live cover preview
- title/date inputs
- color swatches
- cover style segmented control
- decoration segmented control
- save/cancel

Avoid a full cover design canvas.

#### Page Template Editing

Place in journal page toolbar:

- `Page` button opens a compact settings strip or modal
- page title
- background choices
- page template choices
- optional layout template action

If the page contains stickers and user applies a layout template:

> Apply layout to this page? Current sticker positions will be rearranged.

Actions:

- Apply
- Keep positions
- Cancel

#### Sticker Template Editing

Keep in contextual sticker popover:

- template picker
- color swatches
- size controls
- rotation controls
- bring forward
- edit note
- remove from page

Advanced options can be folded under `More`.

### Implementation Plan

| Batch | Scope | Files / Modules | Notes |
| --- | --- | --- | --- |
| J1 | Stabilize current cover gallery | `JournalBookshelfView`, `journal_books` schema | Already partially implemented; keep theme-aware |
| J2 | Add page template fields | `migrations`, `database/index`, `types`, `journalService` | Backfill defaults safely |
| J3 | Add page template picker | `JournalPageView`, `JournalCanvas` | Start with background and title styling |
| J4 | Add sticker template field | `journal_items`, `types`, `journalService`, `JournalSticker` | Preserve current `sticker_style` behavior |
| J5 | Add sticker template picker | `JournalInspector` / popover | Implement text/memo/ticket/quote first |
| J6 | Add layout helper templates | `journalLayout.ts` | Use existing clamp and placement utilities |
| J7 | Add media-aware templates | `note_images`, `JournalSticker` | Only after image note flow is stable |
| J8 | Add template previews and duplication | reusable preview components | Helps users understand choices before applying |

### Suggested Template Presets

#### Book Presets

| Name | Cover Style | Decoration | Mood |
| --- | --- | --- | --- |
| Live Diary | cloth | ticket | event memory |
| Daily Whisper | paper | flower | casual notes |
| Night Archive | night | moon | ASMR / late-night streams |
| Photo Log | minimal | camera | screenshots and images |
| Heart Collection | classic | heart | emotional memories |
| Postcard Box | postcard | none | travel/events/letters |

#### Page Presets

| Name | Background | Layout | Use Case |
| --- | --- | --- | --- |
| Blank Paper | paper | free | manual scrapbook |
| Soft Grid | grid | two-column | neat organization |
| Event Recap | paper | hero-and-notes | one stream/event |
| Monthly Memory | blush/blue/mint | timeline | month summary |
| Photo Board | paper | scattered | image-heavy pages |

#### Sticker Presets

| Name | Template | Use Case |
| --- | --- | --- |
| Note | text | default readable sticker |
| Memo | memo | longer thoughts |
| Ticket | ticket | event/date moments |
| Quote | quote | memorable line |
| Polaroid | polaroid | image and caption |

### Risks

- Too many templates can make the app feel like a design tool.
- Template previews can become expensive if they duplicate rendering logic.
- Image-based stickers depend on a stable note image model.
- Applying layouts to existing pages can feel destructive; require confirmation.

### Success Criteria

- Users can create a visually distinct journal without manual design work.
- Bookshelf and journal pages remain consistent with the selected app theme.
- Stickers stay readable across all templates.
- Templates speed up expression instead of adding configuration burden.
- The source note remains editable and reusable outside the journal.
