import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('../database', () => ({ getDb: async () => ({ execute: mocks.execute }) }))
beforeEach(() => { vi.resetModules(); mocks.execute.mockReset(); mocks.execute.mockResolvedValue({}); const storage = new Map<string,string>(); vi.stubGlobal('localStorage', { getItem: (k:string) => storage.get(k) || null, setItem: (k:string,v:string) => storage.set(k,v), removeItem: (k:string) => storage.delete(k) }) })
it('coalesces ten rapid edits into one changed-field write', async () => {
  const writer = await import('./settingsWriter')
  for(let i=0;i<10;i++) writer.queueAppearance('bgFilters', String(i))
  await writer.flushAppearance()
  expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(expect.any(String), ['bgFilters','9'])
  expect(localStorage.getItem('oshinote.pendingAppearance.v1')).toBeNull()
})
it('serializes a newer value behind an in-flight write', async () => {
  let release!: () => void
  mocks.execute.mockImplementationOnce(() => new Promise<void>(r => { release=r }))
  const writer = await import('./settingsWriter')
  writer.queueAppearance('theme','dark-night')
  await vi.waitFor(() => expect(release).toBeDefined())
  writer.queueAppearance('theme','sakura'); release(); await writer.flushAppearance()
  expect(mocks.execute.mock.calls.map(call => call[1])).toEqual([['theme','dark-night'],['theme','sakura']])
})
it('retains failed writes for retry', async () => {
  mocks.execute.mockRejectedValueOnce(Error('disk failure'))
  const writer = await import('./settingsWriter'); writer.queueAppearance('theme','sakura')
  await expect(writer.flushAppearance()).rejects.toThrow()
  expect(localStorage.getItem('oshinote.pendingAppearance.v1')).toContain('sakura')
  await writer.flushAppearance(); expect(writer.pendingAppearance()).toEqual({})
})
