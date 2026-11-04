import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canonicalJson, sha256Text } from './syncModel'
const mocks = vi.hoisted(() => ({ state: new Map<string,string>(), read: vi.fn(), write: vi.fn(), upload: vi.fn(), dataset: vi.fn() }))
vi.mock('../../database', () => ({ getDb: async () => ({
  select: async (_q:string, args:string[]) => mocks.state.has(args[0]) ? [{value:mocks.state.get(args[0])}] : [],
  execute: async (q:string,args:unknown[]=[]) => {
    if(q.startsWith('INSERT INTO sync_state')) mocks.state.set(String(args[0]),String(args[1]))
    if(q.startsWith('DELETE FROM sync_state')) for(const key of args)mocks.state.delete(String(key))
  },
}) }))
vi.mock('./webdavService',()=>({readWebDavText:mocks.read,writeWebDavText:mocks.write,uploadWebDavAppDataFile:mocks.upload,testWebDavConnection:async()=>({connected:true}),activateSyncCacheFile:vi.fn(),downloadWebDavAppDataFile:vi.fn()}))
vi.mock('./syncDataset',()=>({buildLocalSyncDataset:mocks.dataset,applySyncOperations:vi.fn(),incomingBlobCachePath:vi.fn(),noteImageBlobFromOperation:vi.fn()}))
import { selectSyncRepository, runIncrementalSync, resetIncrementalSyncState } from './incrementalSync'
beforeEach(()=>{mocks.state.clear();vi.clearAllMocks()})
describe('repository identity and incremental media',()=>{
 it('preserves an existing merge base when selecting the same repository through another URL',async()=>{
  const state={repository_id:'nas',device_id:'device',head:'known-head'};mocks.state.set('repository',JSON.stringify(state));mocks.state.set('pendingMerge','{}')
  expect(await selectSyncRepository('nas')).toEqual(state);expect(mocks.state.has('pendingMerge')).toBe(true)
 })
 it('restores separate repository baselines and drops stale conflicts when changing repositories',async()=>{
  mocks.state.set('repository',JSON.stringify({repository_id:'a',device_id:'d',head:'a-head'}));mocks.state.set('repository:b',JSON.stringify({repository_id:'b',device_id:'e',head:'b-head'}));mocks.state.set('pendingMerge','{}')
  expect((await selectSyncRepository('b'))?.head).toBe('b-head');expect(mocks.state.has('pendingMerge')).toBe(false)
  expect((await selectSyncRepository('a'))?.head).toBe('a-head')
  await resetIncrementalSyncState();expect(mocks.state.has('repository:a')).toBe(false);expect(mocks.state.has('repository:b')).toBe(true)
 })
 it('uploads only the changed note when media hashes are unchanged, including a transport alias',async()=>{
  const snapshot={record_hashes:{'notes:n':'old'},media_hashes:{'media/image.png':'same-image'}}
  const commit={format:'oshinote-sync-commit',protocol_version:1,repository_id:'nas',parents:[],schema_version:2,generation:1,snapshot,pack:'unused'}
  const head=await sha256Text(canonicalJson(commit));const text=canonicalJson({...commit,id:head})
  mocks.state.set('repository',JSON.stringify({repository_id:'nas',device_id:'d',head}))
  mocks.dataset.mockResolvedValue({snapshot:{...snapshot,record_hashes:{'notes:n':'new'}},records:new Map([['notes:n',{key:'notes:n',table:'notes',id:'n',value:{id:'n',title:'New note'}}]]),mediaJobs:new Map()})
  mocks.read.mockImplementation(async(_c,path:string)=>({exists:true,etag:'etag',text:path==='repository.json'?JSON.stringify({format:'oshinote-repository',protocol_version:1,repository_id:'nas'}):path.endsWith('refs/main.json')?JSON.stringify({repository_id:'nas',head,generation:1}):path.includes('/commits/')?text:null}))
  mocks.write.mockResolvedValue({bytes:1})
  const result=await runIncrementalSync({baseUrl:'https://another-address:5006',username:'test',password:'test',remotePath:'BackUp/test',allowInvalidCert:false})
  expect(result.status).toBe('pushed');expect(result.uploadedRecords).toBe(1);expect(mocks.upload).not.toHaveBeenCalled()
 })
})
