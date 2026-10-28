# Resource library: phase one

Branch: `codex/resource-library`. Do not merge into main until acceptance.

## Scope

- Resources has two groups: notes / illustrations / tags and materials / uploads / templates.
- Materials and uploads have previews, filters, search, and links to saved usage.
- Upload management replaces the destructive list inside cache settings.
- `resource_assets` is mutable catalogue metadata. `resource_versions` is append-only content.
- Existing material snapshots are retained and assigned deterministic version IDs. Saved definitions take precedence over the live catalogue.
- Version 1 material and sticker renderers live in `components/features/journal/renderers/v1`. Preserve them when introducing a later rendering version.
- User journal templates pin material snapshots and record version dependencies.
- Retiring an uploaded image hides it from selection but retains its row, file and existing page placements. The editor explicitly loads retired images referenced by its page.

## Sync and backups

Sync schema 3 adds assets, immutable versions and upload retirement state. Older sync clients reject newer schema commits. The transport protocol remains v1.

Before committing local state or applying remote records, validate page/template resource dependencies. File-backed historical versions participate in the media snapshot, even when hidden from the picker. Downloads are hash-checked before record activation. Existing file versions with a recorded content hash reject modified bytes. Data-only restores may lack files; those files must be restored before a complete sync/backup can succeed.

Sync deletion of uploads/catalogue records retires them. Version deletion is rejected. Superseded files still referenced by a version are not quarantined. Physical history cleanup is deliberately deferred.

Complete backups already include the database and `media/`; this also covers future `media/resources/` files. Backup and restore now check all referenced original media and retained version files before creating the archive or activating the restored database. Manifest schema metadata uses the current sync schema. Newer backups are rejected before activation.

## Isolated acceptance build

```
pnpm resource:dev
pnpm resource:build
```

These commands use `src-tauri/tauri.resource-test.conf.json` and `.env.resource-test`:

- App identifier: `com.oshinote.resource-test` (separate AppData/WebView storage).
- WebDAV target: `BackUp/OshiNote-ResourceTest` only, with a root WebDAV base URL.
- Both frontend and native commands enforce the remote target. The native check is compiled into the test binary.
- Automatic application updates are disabled in the test build.
- Default production build commands remain unchanged.

Never test against `BackUp/OshiNote`. Do not copy WebView storage or sync credentials from production. When seeding an isolated profile from a consistent SQLite copy, clear only that copy's `sync_state` and `sync_conflicts` so it can join the test repository. Copy media with the database. Do not overwrite an existing test profile.

Local test artefacts and data copies belong under ignored `resource-review.local/`, never in Git. A stable executable and a consistent baseline database/media copy are retained there.

## Acceptance

Automated checks cover migration restart safety, preserved appearance, upload retirement with existing placements, immutable history, dependency validation and remote directory restrictions. The browser integration uses two SQLite copies and a simulated WebDAV object store to exercise the real incremental sync algorithm, media transfers, retirement, independent edits, resource browsing and PNG export. Native tests cover backup media completeness and the remote target guard.

Live NAS connection/restore still requires the isolated application's WebDAV credentials and an explicit test in the dedicated directory. Passing the simulated transport test does not establish NAS connectivity.

## Next phase

User material import, material packs, rename/category/favourite controls, explicit version replacement, template editing/export, recycling UI and reference-aware physical cleanup. Keep these operations behind the immutable version and dependency rules introduced here.
