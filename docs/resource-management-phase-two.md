# Resource management: phase two

This phase runs on `codex/resource-management`. Acceptance builds retain the separate
`com.oshinote.resource-test` profile and `BackUp/OshiNote-ResourceTest` WebDAV target.

## User workflows

- Import PNG, JPEG, WebP and GIF images as stickers, tapes, papers or labels (20 MB per image).
  Imports become managed files and appear immediately in the journal material drawer.
- Rename, group, favourite, archive and restore materials; rename, archive and restore uploads.
- Replacing an imported image appends a version. Existing journal items and layouts retain
  their saved image, dimensions and renderer. A rename affects the catalogue, not saved pages.
- Export a material or template as an `.oshi-resource.json` pack. Packs include immutable
  material versions and their bytes, verified by SHA-256 before import. Existing versions
  cannot be overwritten. A template import creates a new template ID.
- Search/filter, copy, rename, describe, recycle and restore templates. Journal layout changes
  use the existing editor and save-as-template flow. Built-in templates can be copied or hidden.
- Save configured stamps from the stamp settings dialog and select them again there. These
  presets are regular synced templates including the visual stamp snapshot.
- Save a library material as a reusable template; using it creates a separately managed
  material while retaining the same immutable image data.

## Retention and cleanup

Archive/recycle operations are reversible and sync as records. They do not delete resource
history or cascade into old journal pages. Template recycle-bin records retain dependencies.
The cleanup panel lists only unreferenced UUID-named import files older than 24 hours in
`media/resources` and `media/journal`. It checks all versions, uploads, illustrations, journal
snapshots/styles, templates (including recycled ones), sync state and local drafts. It re-scans
before removal, requires explicit selection/confirmation, and never scans backups or recovery
snapshots. Imports, sync and cleanup are serialized within the application session. Existing
sync-cache cleanup remains in the data/backup settings.

## Compatibility

Sync schema is now 4 because older clients cannot render imported material images. Update
other devices before synchronizing this schema. Complete backups include the managed image
files and recognize schema 4; data-only backups still require the associated media.

## Verification

Regression tests cover immutable replacements, archive/restore, resource-pack validation,
material and stamp template round-trips, template recycle/restore, and cleanup reference checks.
Browser acceptance uses two copied SQLite databases, managed file copies, and a simulated
WebDAV store to verify UI imports, rename/replacement, template image transfer, sync and PNG
export. It never uses the production NAS directory. Native acceptance builds use the existing
isolated test profile, leaving the production database and media untouched.
