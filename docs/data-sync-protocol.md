# OshiNote data sync protocol

OshiNote uses WebDAV as an object transport. The live SQLite file is never uploaded by the incremental sync protocol.

## Authority and snapshots

- `sync/v1/refs/main.json` is the only authoritative remote sync state.
- Complete ZIP backups are recovery snapshots derived from local data.
- A WebDAV recovery snapshot is uploaded only after a successful manual incremental sync, so its `head_commit` identifies the represented remote state.
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
- `journal_books`, `journal_pages`, and `journal_items`
- `stamps` and `templates`
- explicitly portable display preferences from `settings`

Search indexes, updater state, WebDAV credentials, AI credentials, device identity, logs, downloaded fonts, and temporary cache are excluded.

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
