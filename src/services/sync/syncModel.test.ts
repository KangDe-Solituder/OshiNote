import { describe, expect, it } from 'vitest'
import { canonicalJson, diffSnapshot, emptySnapshot, mergeSnapshots, type SyncRecord } from './syncModel'

describe('syncModel', () => {
  it('serializes object keys deterministically', () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}')
  })

  it('creates upsert and tombstone operations', () => {
    const records = new Map<string, SyncRecord>([
      ['notes:new', { key: 'notes:new', table: 'notes', id: 'new', value: { id: 'new' } }],
    ])
    const result = diffSnapshot(
      { record_hashes: { 'notes:old': 'one' }, media_hashes: {} },
      { record_hashes: { 'notes:new': 'two' }, media_hashes: {} },
      records
    )
    expect(result.operations).toEqual([
      { key: 'notes:new', table: 'notes', id: 'new', operation: 'upsert', value: { id: 'new' } },
      { key: 'notes:old', table: 'notes', id: 'old', operation: 'delete' },
    ])
  })

  it('merges independent changes and reports true conflicts', () => {
    const base = { record_hashes: { a: '1', b: '1', c: '1' }, media_hashes: {} }
    const local = { record_hashes: { a: '2', b: '1', c: '2' }, media_hashes: {} }
    const remote = { record_hashes: { a: '1', b: '2', c: '3' }, media_hashes: {} }
    const result = mergeSnapshots(base, local, remote)
    expect(result.snapshot.record_hashes).toEqual({ a: '2', b: '2', c: '2' })
    expect(result.take_remote_records).toEqual(['b'])
    expect(result.conflicts).toEqual([
      { key: 'c', kind: 'record', base_hash: '1', local_hash: '2', remote_hash: '3' },
    ])
  })

  it('treats an empty repository as a valid merge base', () => {
    const result = mergeSnapshots(
      emptySnapshot(),
      { record_hashes: { local: 'a' }, media_hashes: {} },
      { record_hashes: { remote: 'b' }, media_hashes: {} }
    )
    expect(result.snapshot.record_hashes).toEqual({ local: 'a', remote: 'b' })
    expect(result.conflicts).toHaveLength(0)
  })
})
