# OshiNote

> A cozy desktop diary app for VTuber / livestream / ASMR fans.  
> Record emotions, archive memories, and enhance fan-writing with AI.

---

# 1. Project Vision

OshiNote is a local-first desktop application designed for fans who want to:

- Record livestream impressions
- Organize fan memories
- Archive emotional moments
- Write messages to their oshi
- Use AI-assisted translation and writing refinement

The application focuses on:

- Emotional UX
- Cozy visual design
- Lightweight local storage
- AI-assisted writing
- Smooth desktop experience

This is NOT a productivity app.

The core design goal is:

> "A warm and personal memory notebook for your oshi."

---

# 2. Tech Stack

## Frontend

- React
- TypeScript
- Vite
- TailwindCSS
- Framer Motion
- Zustand
- React Router

---

## Desktop Runtime

- Tauri v2

Reason:
- Lightweight
- Native performance
- Native filesystem access
- Better memory usage than Electron

---

## Database

- SQLite

Use:
- better-sqlite3 or tauri sqlite plugin

Rich text content stored as JSON.

---

## Rich Text Editor

Recommended:
- Tiptap

Reason:
- Modern
- Extensible
- React-friendly
- Easy formatting support

Required features:
- Bold
- Italic
- Underline
- Strike
- Font size
- Text color
- Emoji insertion
- Cute preset fonts

---

## Graph / Visualization

- React Flow
or
- D3.js (later stage)

Used for:
- tag relationship graph
- emotion visualization

---

## AI Integration

Abstraction layer design.

Support:
- OpenAI
- Claude
- Gemini
- Local API

All providers should follow unified interface.

---

# 3. Core Product Structure

The application uses:

```txt
Sidebar (left)
+
Main Workspace (right)
```

---

# 4. Main Modules

## 4.1 Sidebar

Collapsible.

Animated width transition.

Contains:

### Sections

- Home
- Oshis
- Tags
- AI Tools
- Export
- Settings

---

## 4.2 Oshi Management

Users can create multiple oshis.

Each oshi contains:

```ts
type Oshi = {
  id: string
  name: string
  avatar?: string
  color?: string
  createdAt: string
}
```

---

## 4.3 Archive System

Each oshi has archives.

Default archive groups:

- Spring
- Summer
- Autumn
- Winter

Users may customize:
- stream impressions
- CI-EN
- voice packs
- anniversary
- emotional moments

Structure:

```txt
Oshi
└── Archive
    └── Notes
```

---

# 5. Note System

## 5.1 Note Data Structure

```ts
type Note = {
  id: string
  oshiId: string

  title: string

  content: JSON

  plainText: string

  tags: string[]

  createdAt: string
  updatedAt: string

  favorite?: boolean
}
```

---

## 5.2 Rich Text Features

Required:

- Bold
- Underline
- Strike
- Font size
- Text color
- Highlight
- Emoji support
- Japanese kaomoji presets

Optional later:
- image insertion
- quote blocks
- stream timestamp cards

---

## 5.3 Search

Search by:

- title
- tag
- content
- date range

Must support:
- instant filtering
- pagination
- fuzzy search later

---

# 6. Note Display Modes

## 6.1 Card View

Visual cozy mode.

Layouts:
- sticky note
- bookshelf
- postcard

Display:
- title
- tags
- date
- preview snippet

Paginated.

---

## 6.2 Compact List View

Performance-first mode.

Single row per note:

```txt
Title | Tags | Date
```

Supports:
- virtual scrolling
- pagination

---

## 6.3 Tag Relationship View

Visual graph mode.

Each tag:
- node size = usage frequency

Edges:
- co-occurrence count

Purpose:
- emotional memory visualization

This is a later-stage feature.

---

# 7. Theme System

One of the core features.

## 7.1 Preset Themes

Examples:
- Pink Cozy
- Dark Night
- Soft Blue
- Sakura
- Rainy Cafe

---

## 7.2 Custom Background

User may upload:

- image
- wallpaper
- fanart

Controls:
- blur
- brightness
- opacity
- saturation

---

## 7.3 Theme Hotkeys

Users can save theme presets.

Example:

```txt
Ctrl + 1 → Pink theme
Ctrl + 2 → Dark ASMR theme
```

---

# 8. AI Features

IMPORTANT:
AI should enhance writing.

AI is NOT the core product itself.

---

## 8.1 Translation

Layout:

```txt
Left: Original text
Right: Translated result
```

Supports:
- Japanese
- Chinese
- English

---

## 8.2 Writing Refinement

User may provide:
- draft fan message
- stream impression
- tweet reply

AI helps:
- grammar
- natural phrasing
- politeness
- emotional tone

---

## 8.3 Context Reference

User can attach:
- tweets
- stream summaries
- text references

AI uses them as:
- style/context hints

---

## 8.4 Future AI Features

NOT MVP:

- sentiment analysis
- emotion timeline
- auto tag suggestion
- stream summary generation

---

# 9. Export System

Users own their data.

Required export formats:

- JSON
- Markdown
- TXT

Optional later:
- PDF
- HTML diary

---

# 10. Local-First Philosophy

The application should work fully offline except AI functions.

User data belongs entirely to the user.

No mandatory cloud sync.

No account system in MVP.

---

# 11. UI / UX Design Principles

The app should feel:

- warm
- soft
- emotional
- personal

Avoid:
- enterprise design
- productivity aesthetics
- Notion-like minimalism
- IDE feeling

Preferred:
- rounded corners
- glassmorphism
- smooth animations
- floating cards
- cozy typography

---

# 12. Recommended Folder Structure

```txt
src/

  components/
  features/
    notes/
    oshis/
    ai/
    settings/
    themes/

  pages/

  stores/

  database/

  services/
    ai/
    export/

  hooks/

  styles/

  types/
```

---

# 13. Suggested Development Order

IMPORTANT:
Do NOT build everything at once.

## Phase 1 (MVP)

Build first:

- Sidebar
- Oshi system
- Note CRUD
- Rich text editor
- Search
- Theme system

NO AI YET.

---

## Phase 2

Add:
- AI translation
- AI refinement
- Export system

---

## Phase 3

Add:
- Tag graph
- Emotion visualization
- Tweet references
- Stream timeline

---

## Phase 4 (Optional)

Add:
- Realtime subtitle integration
- OCR
- Whisper integration
- Stream assistant tools

---

# 14. Non-Goals (Important)

The project is NOT trying to become:

- Notion
- Obsidian
- Discord
- Full livestream assistant platform

Keep scope focused.

---

# 15. Product Identity

OshiNote is:

> "A cozy AI-assisted emotional notebook for oshi activities."

Not:
- a productivity tool
- a generic note-taking app
- a social platform

---

# 16. MVP Success Criteria

The MVP is successful if users can:

1. Create oshis
2. Write cozy stream impressions
3. Organize memories comfortably
4. Search old memories
5. Enjoy the UI atmosphere
6. Use AI to refine fan-writing

That is enough for version 1.

