import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ invoke: vi.fn(), load: vi.fn(), migrate: vi.fn(), checkpoint: vi.fn(), close: vi.fn(), execute: vi.fn(), select: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mock.invoke }))
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: mock.load } }))
vi.mock('../../database', () => ({ migrateDatabase: mock.migrate, checkpointDatabase: mock.checkpoint, withClosedDatabase: (work: () => Promise<unknown>) => work() }))
import { prepareRestore, discardRestore } from './restore'
const prepared = { token: '1-0', database_url: 'sqlite:restore-1-0.db', media_prefix: '.restore-1-0', created_at: '1', app_version: null, database_schema_version: 0, mode: 'complete' }

describe('staged restore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.invoke.mockImplementation(async (command: string) => command === 'prepare_backup_restore' ? prepared : undefined)
    mock.load.mockResolvedValue({ select: mock.select, execute: mock.execute, close: mock.close })
    mock.select.mockResolvedValue([])
    mock.close.mockResolvedValue(true)
  })
  it('migrates and validates only the temporary copy, without activating it', async () => {
    expect(await prepareRestore('backup.oshi.zip')).toEqual(prepared)
    expect(mock.load).toHaveBeenCalledWith(prepared.database_url)
    expect(mock.migrate).toHaveBeenCalledWith(expect.anything(), '.restore-1-0')
    expect(mock.close).toHaveBeenCalledOnce()
    expect(mock.invoke.mock.calls.map(x => x[0])).toEqual(['prepare_backup_restore', 'validate_prepared_restore'])
    expect(mock.execute.mock.calls.map(x => x[0])).toContain('DELETE FROM sync_state')
  })
  it('closes and discards the temporary copy when migration fails', async () => {
    mock.migrate.mockRejectedValue(new Error('Migration failed'))
    await expect(prepareRestore('old.oshi.zip')).rejects.toThrow('Migration failed')
    expect(mock.close).toHaveBeenCalledOnce()
    expect(mock.invoke.mock.calls.map(x => x[0])).toEqual(['prepare_backup_restore', 'discard_prepared_restore'])
  })
  it('stops at the native version check when the backup is too new', async () => {
    mock.invoke.mockRejectedValue(new Error('Update OshiNote first'))
    await expect(prepareRestore('future.oshi.zip')).rejects.toThrow('Update OshiNote')
    expect(mock.load).not.toHaveBeenCalled()
  })
  it('rejects broken resource references before presenting a restore confirmation', async () => {
    mock.select.mockImplementation(async (sql: string) => sql.includes('resource_assets') ? [{ id: 'asset', current_version_id: 'missing' }] : [])
    await expect(prepareRestore('broken.oshi.zip')).rejects.toThrow('Missing resource version')
    expect(mock.invoke.mock.calls.map(x => x[0])).toEqual(['prepare_backup_restore', 'discard_prepared_restore'])
  })
  it('cancel only discards staging and never activates the backup', async () => {
    await discardRestore(prepared)
    expect(mock.invoke).toHaveBeenCalledExactlyOnceWith('discard_prepared_restore', { token: '1-0' })
  })
})
