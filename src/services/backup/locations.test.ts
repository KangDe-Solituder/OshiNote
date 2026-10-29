import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
import { loadLocations, saveLocations, type LocationSettings } from './locations'
const key = 'oshinote.data.locations.v1'
const settings: LocationSettings = { syncId:'test',backupId:'test',locations:[{id:'test',name:'Synthetic',kind:'webdav',config:{baseUrl:'https://example.invalid',remotePath:'isolated',username:'test',password:'SYNTHETIC_SECRET',allowInvalidCert:false}}] }
beforeEach(() => { const storage = new Map<string,string>(); vi.stubGlobal('localStorage', { getItem:(k:string)=>storage.get(k)||null, setItem:(k:string,v:string)=>storage.set(k,v), removeItem:(k:string)=>storage.delete(k) }); mocks.invoke.mockReset(); mocks.invoke.mockImplementation(async command => command === 'protect_connection_secret' ? [1,2,3] : 'SYNTHETIC_SECRET') })
it('replaces legacy plaintext only after protection succeeds', async () => {
  localStorage.setItem('oshinote.webdav.config', JSON.stringify((settings.locations[0] as {config:unknown}).config))
  await saveLocations(settings)
  expect(localStorage.getItem(key)).not.toContain('SYNTHETIC_SECRET')
  expect(localStorage.getItem('oshinote.webdav.config')).toBeNull()
  const loaded = await loadLocations(); expect(loaded.locked).toBe(false)
  expect(loaded.settings.locations[0]).toMatchObject({config:{password:'SYNTHETIC_SECRET'}})
})
it('does not discard legacy credentials on protection failure', async () => {
  localStorage.setItem(key,JSON.stringify(settings)); mocks.invoke.mockRejectedValueOnce(Error('locked'))
  await expect(saveLocations(settings)).rejects.toThrow('locked')
  expect(localStorage.getItem(key)).toBe(JSON.stringify(settings))
})
it('keeps an encrypted password when it cannot be decrypted on this device', async () => {
  await saveLocations(settings); const stored=localStorage.getItem(key)
  mocks.invoke.mockRejectedValueOnce(Error('other account'))
  const loaded=await loadLocations(); expect(loaded.locked).toBe(true); expect(localStorage.getItem(key)).toBe(stored)
})
