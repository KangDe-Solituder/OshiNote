# OshiNote

<p align="center">
  <strong>English</strong>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
  ·
  <a href="./README.ja.md">日本語</a>
</p>

OshiNote is a local-first desktop app for keeping, arranging, and revisiting memories about your oshi.

It is not meant to be a generic note app or a social posting tool. Its core is a private memory studio: you create oshi spaces, write notes after streams or events, collect illustrations, arrange journal pages, and gradually turn scattered feelings into a personal archive.

> The product goal: help oshi-life memories become searchable, beautiful, and worth keeping.

## What OshiNote Is For

- Record feelings, stream impressions, event memories, and daily oshi-life fragments.
- Keep notes, images, tags, archives, and journal pages connected to each oshi.
- Build handmade-style journal pages with notes, images, stamps, and later tape, paper notes, stickers, and postcard templates.
- Keep data local by default, with privacy and long-term ownership as a first principle.
- Support English, Simplified Chinese, and Japanese as first-class UI languages.

## Current Stage

OshiNote is in an early but usable desktop stage.

The main app shell, local SQLite storage, oshi spaces, note editor, illustration library, journal module, resource skeleton, stamp workflow, themes, and trilingual UI are already in place. Journal has moved from a simple canvas prototype to a composition-oriented flow with page setup, resource drawers, canvas placement, and a more detailed edit mode. The next stage is stabilizing this foundation, splitting large components, and then expanding templates and built-in materials.

## Implemented

### App Shell

- Tauri desktop shell with a custom top window bar.
- Resizable sidebar for My Oshis.
- Bottom sidebar entries for Home, Export, and Settings.
- Top-level navigation for Journal and Resources.
- Multiple themes, glass effect, font size controls, and motion speed controls.

### Internationalization

- English, Simplified Chinese, and Japanese UI.
- Language selection is saved locally.
- New features are expected to ship with all three languages.

### Oshi Spaces

- Create and manage oshi profiles.
- Store avatar, description, color, and related links.
- View overview, notes, images, and tags for each oshi.
- Oshi overview shows recent notes, recent images, and basic counts.

### Notes

- TipTap rich-text editor.
- Formatting controls for bold, italic, underline, strike, size, font, color, highlight, and emoji.
- Metadata for date, archive, oshi, source URL, tags, and attachments.
- Real-time character and word count.
- Tag suggestions from historical tags while typing.
- Archive tabs and archive management on oshi note pages.
- Search, grid/list style browsing, favorite, save, delete, and image attachments.

### Illustrations / Images

- Import PNG, JPEG, and WebP images.
- Store copied media files in the local app data directory.
- Browse images globally or by oshi.
- Filter by all / official / fanart / favorite.
- Card, grid, and list layouts.
- Detail panel and fullscreen preview.
- Delete image metadata and copied local media together.

### Journal

- Top-level Journal module.
- Books and loose pages.
- Page creation flow with setup, notes, images, materials, stamp, and review steps.
- Canvas-based composition editor for arranging notes, images, built-in materials, and stamps.
- View mode for careful page review plus a dedicated detailed edit mode.
- Page setup supports title, date label, description, background preset, oshi, book collection, and orientation.
- Built-in material prototype for tape, stickers, paper notes, and labels.
- Shared style payload helpers keep note cards, image frames, and materials consistent after save/reopen.
- Legacy oshi-journal paths redirect to the top-level journal module.

### Resources And Templates

- Resource routes are present:
  - `/resources`
  - `/resources/templates`
  - `/resources/materials`
- Template foundation exists with read-only built-in template cards.
- A `templates` table exists through non-destructive migration.
- Materials is still a placeholder direction rather than a complete library.

### Stamp System

- Single stamp per target for Note, Illustration, and Journal Page.
- Modal-based stamp settings.
- Stamp materials such as round, date, wax seal, paper label, seal script, flourish, and calligraphy-gated styles.
- Free placement flow: configure, click Stamp, move ghost stamp, left-click to place.
- Size, rotation, opacity, color, and text controls.
- Preview inside the modal.
- Stamps can be saved, cleared, and reloaded.
- Optional stamp fonts can be downloaded from Settings into the app data directory.
- PNG stamp import is planned but not implemented yet.

## Not Implemented Yet

- Full user-facing material library management.
- User-uploaded stickers and reusable custom materials.
- Advanced material packs and template packs.
- Postcard templates and postcard gacha.
- LLM-assisted tag pool understanding and quote extraction.
- User-imported PNG stamps.
- Advanced journal templates with fixed slots.
- Full export / backup / restore workflow.
- Search normalization for Japanese readings, aliases, and kana/kanji expansion.
- Route-level code splitting and deeper performance audits.

## Next Direction

### 1. Journal Stability And Component Boundaries

The Journal feature is now expressive enough that the next engineering step should be stabilization before more surface area is added.

Recommended order:

1. Split `JournalCreationFlow` into setup, rail, edge drawer, resource drawers, and review components.
2. Split `JournalDraftCanvas` into item frame, renderers, detail panel, and interaction hooks.
3. Share visual renderers between view mode and detailed edit mode.
4. Add focused tests for pure layout, style payload, draft conversion, and popover positioning.

This keeps the handmade direction flexible without letting the editor become fragile.

### 2. Template Foundation For Postcards

Postcard gacha should not start as random collage. It should be built on templates.

A postcard template should define slots such as:

- image
- note excerpt
- date
- tags
- decoration
- blank space

Only after those layout rules exist should the app randomly fill them from notes, images, tags, archives, favorites, or time ranges.

### 3. Postcard Gacha

The gacha flow should eventually:

- choose a template
- choose a card pool
- randomly fill the template
- preview the postcard
- reroll
- save the result to a Journal page

### 4. LLM Pool Understanding

LLM support should be a later enhancement, not a v1 dependency.

Good LLM tasks include:

- group related tags into themed pools
- extract postcard-friendly quotes from long notes
- recommend templates
- generate short postcard titles
- identify content themes such as anniversary, healing, live recap, movie memory, or monthly review

## Tech Stack

| Area | Stack |
| --- | --- |
| Desktop runtime | Tauri v2, Rust |
| Frontend | React 19, TypeScript, Vite |
| Styling and motion | Tailwind CSS, Framer Motion, Lucide React |
| Routing and state | React Router 7, Zustand |
| Rich-text editor | TipTap 3 |
| Local database | SQLite, `@tauri-apps/plugin-sql` |
| Desktop capabilities | Tauri Dialog / FS / Process / SQL / Updater plugins |
| Large lists | TanStack React Virtual |

## Development

Install dependencies:

```bash
pnpm install
```

Run the desktop app:

```bash
pnpm tauri dev
```

Run frontend preview only:

```bash
pnpm dev
```

Some features depend on Tauri SQLite, filesystem, and window APIs. Use `pnpm tauri dev` for real feature testing.

Quality checks:

```bash
pnpm lint
pnpm test
pnpm build
```

or:

```bash
pnpm quality
```

Build the desktop app:

```bash
pnpm tauri build
```

## Data And Privacy

- Data is stored locally by default.
- Profiles, notes, tags, journals, templates, stamps, and settings live in SQLite or local app preferences.
- Imported images are copied into the local app data directory.
- Optional stamp fonts are saved into the app data directory.
- Local databases, personal media, logs, and build outputs should not be committed.

## Project Structure

```text
OshiNote/
|-- src/
|   |-- components/        # UI, layout, editor, journal, stamp components
|   |-- features/          # Feature services and domain logic
|   |-- hooks/             # Shared React hooks
|   |-- i18n/              # English / Chinese / Japanese translations
|   |-- pages/             # Route pages
|   |-- services/          # Media, export, update, AI services
|   |-- stores/            # Zustand stores
|   |-- utils/             # Shared safe parsing/storage helpers
|   `-- styles/            # Themes and global styles
|-- docs/                  # Architecture and stabilization notes
|-- public/                # Static assets and optional font placeholders
|-- src-tauri/             # Rust / Tauri app
|-- local-dev-plan/        # Local planning notes, not meant for release docs
|-- package.json
`-- vite.config.ts
```

## License

This project is released under the [MIT License](./LICENSE).

## Thanks

Thanks to Rust, Tauri, React, Vite, SQLite, TipTap, and the open-source maintainers behind the project.

OshiNote is shaped by actual oshi-life usage: build a little, use it, feel what is missing, and then make the next piece more useful and more personal.
