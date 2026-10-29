import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), read: vi.fn(), write: vi.fn(), upload: vi.fn(), download: vi.fn() }))
vi.mock('@tauri-apps/api/path', () => ({ appDataDir: async () => 'C:/isolated', join: async (...parts: string[]) => parts.join('/') }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('../../database', () => ({ withClosedDatabase: (work: () => Promise<unknown>) => work() }))
vi.mock('./index', () => ({ readBackupSyncMetadata: async () => ({ schema_version: 4 }) }))
vi.mock('../sync/webdavService', () => ({ readWebDavText: mocks.read, writeWebDavText: mocks.write, uploadWebDavAppDataFile: mocks.upload, downloadWebDavAppDataFile: mocks.download }))
import { createLocationBackup, listLocationBackups, resolveBackupFile } from './catalog'
import type { DataLocation } from './locations'
const cloud: DataLocation = { id: 'c', name: 'Test', kind: 'webdav', config: { baseUrl: 'https://example.invalid', remotePath: 'BackUp/OshiNote-ResourceTest', username: '', password: '', allowInvalidCert: false } }

describe('backup locations and history', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.invoke.mockResolvedValue({ path: 'C:/test/backups/oshinote-100-0.oshi.zip' }); mocks.upload.mockResolvedValue({ bytes: 12 }); mocks.write.mockResolvedValue({}) })
  it('writes a local full backup without contacting WebDAV', async () => {
    await createLocationBackup({ id: 'l', name: 'Local', kind: 'local', directory: 'C:/test' })
    expect(mocks.invoke).toHaveBeenCalledWith('create_directory_backup', expect.objectContaining({ directory: 'C:/test' }))
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled()
  })
  it('preserves concurrent catalog additions when the first conditional write conflicts', async () => {
    const other = { name: 'oshinote-99-0.oshi.zip', path: 'backups/oshinote-99-0.oshi.zip', bytes: 5 }
    mocks.read.mockResolvedValueOnce({ exists: false, text: null }).mockResolvedValueOnce({ exists: true, etag: 'v2', text: JSON.stringify([other]) })
    mocks.write.mockRejectedValueOnce(new Error('WEBDAV_PRECONDITION_FAILED'))
    await createLocationBackup(cloud)
    const args = mocks.write.mock.calls[1]
    expect(JSON.parse(args[2])).toContainEqual(other)
    expect(args[3]).toEqual({ ifMatch: 'v2', ifNoneMatch: false })
  })
  it('does not overwrite a catalog if an existing server entry has no ETag', async () => {
    mocks.read.mockResolvedValue({ exists: true, etag: null, text: '[]' })
    await expect(createLocationBackup(cloud)).rejects.toThrow('ETag')
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it('rejects unsafe remote backup entries', async () => {
    mocks.read.mockResolvedValue({ exists: true, text: JSON.stringify([{ name: '../secret', path: '../secret', bytes: 1 }]) })
    await expect(listLocationBackups(cloud)).rejects.toThrow('catalog')
  })
})

it.each(['backups/oshinote-1-0.oshi.zip','oshinote-latest-full.oshi.zip'])('stages %s under the native download allowlist',async path=>{
  const result=await resolveBackupFile(cloud,{name:path.split('/').at(-1)!,path,bytes:1})
  expect(result).toMatch(/^C:\/isolated\/sync-cache\/restore-.*\.oshi\.zip$/)
  expect(mocks.download).toHaveBeenLastCalledWith(cloud.kind === 'webdav' ? cloud.config : null,path,expect.stringMatching(/^sync-cache\/restore-/))
})
