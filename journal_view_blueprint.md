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
