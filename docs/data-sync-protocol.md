# OshiNote data sync protocol

OshiNote uses WebDAV as an object transport. The live SQLite file is never uploaded by the incremental sync protocol.

## Authority and snapshots

- `sync/v1/refs/main.json` is the only authoritative remote sync state.
- Complete ZIP backups are recovery snapshots derived from local data.
- A complete backup can be created independently of sync, including while offline. Its legacy `head_commit` field records the last applied synchronization baseline, not the exact contents of the ZIP; local unsynced edits are included.
- Restoring a ZIP never rewrites the remote HEAD directly.

## Remote layout

```text
<remote root>/
├─ repository.json
├─ oshinote-latest-full.oshi.zip
└─ sync/v1/
   ├─ refs/main.json
   └─ objects/
      ├─ commits/<prefix>/<sha256>.json
      ├─ packs/<prefix>/<sha256>.json
      └─ blobs/sha256/<prefix>/<sha256>
```

Commit, pack, and blob objects are immutable and content addressed. Writers upload immutable objects first and update `refs/main.json` last with `ETag`/`If-Match` or `If-None-Match`. Servers that do not expose ETags receive an additional HEAD comparison immediately before the final write; this fallback is intended for manual, single-user operation and has weaker concurrent-writer guarantees.

## Logical records

The following user-content tables participate in sync:

- `oshis`, `archives`, `notes`, and `note_images`
- `illustrations`
- `journal_books`, `journal_pages`, `journal_items`, and `journal_images`
- `resource_assets` and immutable `resource_versions`
- `oshi_schedules` and `oshi_schedule_overrides`
- `stamps` and `templates`
- explicitly portable display preferences from `settings`

Search indexes, updater state, connection credentials, device identity, logs, downloaded fonts, and temporary cache are excluded.

Note image data URLs are converted to content-addressed blobs for transport and reconstructed when applied locally. Illustration originals are uploaded as blobs; thumbnails remain regenerable local data.

## Merge rules

Each local device stores its last applied HEAD. A manual sync compares three snapshots:

1. the last applied commit;
2. the current logical local dataset;
3. the current remote HEAD.

Independent record changes merge automatically. A record changed differently on both sides becomes an explicit conflict. Deletions are represented as pack operations and therefore propagate without relying on wall-clock timestamps. Conflict decisions produce a merge commit with the remote and local commits as parents.

Server timestamps are display metadata only. Commit ancestry, generations, hashes, and conditional HEAD updates determine ordering and concurrency.

## Media and cache safety

Downloaded blobs are written under `sync-cache/`, verified by SHA-256, and only then atomically activated into `media/`. Replaced or remotely deleted media is moved into `sync-cache/orphans/` instead of being erased. Cache cleanup is restricted to `sync-cache/`; it cannot directly address active original media, SQLite data, commits, or recovery snapshots.

The first protocol version does not delete immutable remote objects. This deliberately favors recoverability over reclaiming remote storage.


## Full backup and restore (schema 2)

- Local and WebDAV locations are device-local. Windows passwords are protected with DPAPI; they are never exported or synchronized. A different Windows account must re-enter its password. Connection addresses are not restored over the current device's configuration.
- Full ZIPs contain the database, retained media, and downloaded fonts. A temporary database copy is sanitized using a closed list of portable UI settings and VACUUM; transient sync state/conflicts are removed. The active database is not sanitized by export. Historical ZIPs are not rewritten.
- New cloud backups live in `backups/oshinote-<timestamp>-<sequence>.oshi.zip`, with a conditional-write `backups/index.json`. The legacy root `oshinote-latest-full.oshi.zip` remains readable. Both download to `sync-cache/restore-<uuid>.oshi.zip`.
- Restore extracts into isolated paths, migrates on a dedicated SQLite connection, verifies integrity and resources, then waits for confirmation. Activation retains its rollback journal. Restoring starts a new sync association and never updates remote HEAD.
- Migration uses one `BEGIN IMMEDIATE` transaction, a schema ledger, and a pre-v2 local safety copy on normal startup. That safety copy is private local recovery material, may retain old configuration, and is not published as a sanitized backup. Interrupted old table replacements are recovered; ambiguous extra records cause a safe stop rather than deletion.
- Resource limits: 100,000 ZIP entries, 1 MiB manifest, 8 GiB per extracted file and 32 GiB total declared size; extraction also enforces each entry's actual byte budget. Network connections time out after 15 s, idle reads after 60 s and operations after 30 minutes. Uploads/downloads stream files and cap their size at 32 GiB.
- Note saves remain manual. Body, attachments, and stamp commit together; leaving with unsaved edits requires confirmation. No automatic Note recovery drafts are created.
