# OshiNote

<p align="center">
  <strong>English</strong>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
  ·
  <a href="./README.ja.md">日本語</a>
</p>

OshiNote is a local-first desktop app for recording and organizing oshi memories.

It aims to create a quiet, warm, and long-lasting private space where you can keep profiles for your oshis, write down feelings after streams, collect meaningful illustrations, and gradually turn notes, loose pages, and journals into your own memory archive.

> Record memories, emotions, and stream impressions for your oshi.

## Current Status

OshiNote is currently in an early but usable stage. The desktop shell, local SQLite database, oshi spaces, rich-text notes, illustration library, top-level journal module, and trilingual UI are already in place.

The project is currently moving in three directions:

- Stabilizing the framework, animation smoothness, resource loading, memory usage, and build checks.
- Improving the creative and organizing experience for Notes, Illustrations, Journals, Books, and Postcards.
- Adding more oshi-life-inspired features, such as template/material management, a stamp system, and freer journal creation.

## Features

### Oshi Spaces

- Create and manage oshi profiles with avatar, description, theme color, and related links.
- View notes, illustrations, and tags under each oshi space.
- See recent notes and recent illustrations on the oshi homepage.

### Notes

- Rich-text editor powered by TipTap.
- Supports bold, italic, underline, strike, font size, font family, text color, highlight, and emoji controls.
- Supports metadata such as date, category, related oshi, and source link.
- Supports favorite, delete, save, archive status, tags, and keyword search.

### Illustrations

- Import local PNG, JPEG, and WebP images.
- Imported files are copied into the app's local data directory and tracked in the database.
- Browse illustrations globally or inside a specific oshi space.
- Switch between card, dense grid, and list layouts.
- Open a right-side detail panel with metadata, favorite, edit, and delete actions.
- Click the detail image to open a fullscreen preview.
- Deleting an illustration also deletes the copied local media files.

### Journals

- Journal is now a top-level module instead of being locked inside a specific oshi space.
- The journal management page organizes books and loose pages in a bookshelf-style view.
- The journal creation desk can be opened directly from the sidebar.
- Notes and illustrations can be arranged on a canvas-like page.
- A right drawer handles page title, date, description, background, and collection settings.
- Pages can be saved into a Book or kept as loose pages.
- Old oshi-journal routes are redirected to the new top-level journal module for compatibility.

### Internationalization

- Supports English, Simplified Chinese, and Japanese.
- English is the default language.
- The selected language is saved locally and restored the next time the app opens.

### Appearance And Motion

- Multiple visual themes.
- Adjustable UI font size and animation speed.
- Dropdowns, drawers, dialogs, detail panels, and fullscreen previews share a unified overlay and motion behavior.

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

## Installation

### Prerequisites

Install:

- Node.js and pnpm
- Rust
- System dependencies required by Tauri

See [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) for platform-specific requirements.

On Windows, Microsoft C++ Build Tools and WebView2 Runtime may also be required. Modern Windows systems usually include WebView2, but the official Tauri documentation should be treated as the source of truth.

### Clone

```bash
git clone https://github.com/KangDe-Solituder/OshiNote.git
cd OshiNote
pnpm install
```

SSH works as well:

```bash
git clone git@github.com:KangDe-Solituder/OshiNote.git
cd OshiNote
pnpm install
```

### Development

Run the full desktop app:

```bash
pnpm tauri dev
```

Run only the Vite frontend:

```bash
pnpm dev
```

Some pages depend on Tauri's SQLite and filesystem APIs. For real feature testing, use `pnpm tauri dev`; the standalone Vite server is mainly useful for quick UI checks.

### Quality Check

```bash
pnpm quality
```

This runs:

```bash
pnpm lint
pnpm build
```

You can also run them separately:

```bash
pnpm lint
pnpm build
```

### Build

Build the desktop app:

```bash
pnpm tauri build
```

Verify the desktop binary without generating installers:

```bash
pnpm tauri build --no-bundle
```

Build only the frontend static assets:

```bash
pnpm build
```

Desktop build output is generated under `src-tauri/target/` and should not be committed.

## Data And Privacy

- OshiNote stores data locally by default.
- Profiles, notes, tags, journals, and settings are stored in a local SQLite database.
- Imported illustration files are copied into the app data directory, for example `media/illustrations/originals/{year}` and `media/illustrations/thumbnails/{year}`.
- Deleting an illustration also deletes the copied local media files.
- Do not commit local databases, personal media files, temporary logs, or build output.

## Project Structure

```text
OshiNote/
|-- src/
|   |-- components/        # Shared UI and layout components
|   |-- features/          # Feature modules
|   |-- i18n/              # Trilingual translations and language helpers
|   |-- pages/             # Route pages
|   |-- services/          # Data, media, and app services
|   |-- stores/            # Zustand stores
|   `-- styles/            # Global styles and design tokens
|-- public/                # Static web assets
|-- src-tauri/
|   |-- src/               # Rust / Tauri entry
|   |-- capabilities/      # Tauri permission configuration
|   |-- icons/             # Desktop app icons
|   |-- Cargo.toml
|   `-- tauri.conf.json
|-- package.json
`-- vite.config.ts
```

## Development Notes

- Prefer running `pnpm quality` before pushing.
- Features involving the database, media, filesystem, or desktop permissions should be tested inside the Tauri runtime.
- Keep local plans, temporary test logs, personal media, local databases, and build output out of Git.
- Route compatibility matters: old journal paths should continue to redirect smoothly to the new top-level journal module.
- After UI changes, check dropdowns, drawers, dialogs, detail panels, and fullscreen previews across themes and animation speeds.

## Search Notes

Current note search matches the literal text stored in titles, rich-text content, plain text content, and tags.

It does not yet perform Japanese reading normalization or kana/kanji expansion. For example, a note containing `お疲れ様` will not currently match a search for `おつ`.

Future search improvements may add reading dictionaries or custom aliases so common expressions such as `おつ` and `お疲れ様` can be matched together.

## Roadmap

- Resource management: centralize notes, illustrations, templates, and reusable materials.
- Template system: save template snapshots when a Note or Journal uses a template, so old content remains stable even if the source template changes.
- Stamp system: add save-time or free-position stamps for Notes, Illustrations, Postcards, and Journal Pages.
- Journal improvements: richer page templates, book/postcard collection flows, and better canvas editing.
- Export and backup: JSON, Markdown, TXT, media export, and restore flows.
- Performance polish: route-level code splitting, large-list virtualization, media loading checks, and memory/resource audits.

## License

This project is released under the [MIT License](./LICENSE).

## Thanks

Thanks to Rust, Tauri, React, Vite, SQLite, TipTap, and all open-source maintainers behind the project's dependencies.

OshiNote grows through a very personal kind of vibe coding: real oshi-life experience decides the direction, implementation keeps iterating, and daily use tells us whether it truly feels useful, beautiful, and worth keeping.
