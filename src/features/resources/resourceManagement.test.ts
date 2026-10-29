/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from '@tauri-apps/plugin-sql'
import { ensureResourceSchema } from './resourceSchema'
import { reconcileResourceLibrary } from './resourceLibrary'
import { deleteMaterial, importMaterial, loadMaterialLibrary, updateResource, instantiateMaterialTemplate } from './resourceManagement'
import { getMaterialSnapshot, getJournalMaterialDefinition, resolveMaterialSnapshot } from '../journal/journalMaterials'
import { exportMaterialPack, exportTemplatePack, importResourcePack, validatePackShape } from './resourcePacks'
import { createResourceTemplate, duplicateResourceTemplate, fetchResourceTemplates, updateResourceTemplate } from '../templates/templateService'
import { getJournalPageTemplateDefinition, toResourceTemplate } from '../journal/journalPageTemplates'
import { inspectResourceCleanup, cleanResourceFiles } from './resourceCleanup'
import { validateResourceGraph } from './resourceIntegrity'
import type { SyncRecord } from '../../services/sync/syncModel'

const shared = vi.hoisted(()=>({ getDb:vi.fn(), invoke:vi.fn(), files:new Map<string,Uint8Array>(), written:'', modified:new Map<string,number>() }))
vi.mock('../../database',()=>({getDb:shared.getDb,generateId:()=>crypto.randomUUID()}))
vi.mock('@tauri-apps/api/core',()=>({isTauri:()=>true,invoke:shared.invoke}))
vi.mock('@tauri-apps/plugin-dialog',()=>({save:async()=>'/pack.json'}))
vi.mock('@tauri-apps/plugin-fs',()=>({
  BaseDirectory:{AppData:1}, mkdir:async()=>{},
  exists:async(path:string)=>shared.files.has(path)||path==='media/resources',
  writeFile:async(path:string,data:Uint8Array)=>{shared.files.set(path,data);shared.modified.set(path,Date.now())},
  readFile:async(path:string)=>{if(!shared.files.has(path))throw Error('Missing file');return shared.files.get(path)},
  writeTextFile:async(_path:string,text:string)=>{shared.written=text},
  readDir:async()=>[...shared.files.keys()].filter(p=>p.startsWith('media/resources/')).map(p=>({name:p.split('/').pop(),isFile:true,isSymlink:false})),
  stat:async(path:string)=>({size:shared.files.get(path)?.length,mtime:new Date(shared.modified.get(path)!)}),
  remove:async(path:string)=>{shared.files.delete(path)},
}))
let sqlite:DatabaseSync, db:Database
async function resetDatabase(){
  sqlite=new DatabaseSync(':memory:')
  sqlite.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE journal_images(id TEXT PRIMARY KEY,file_path TEXT,original_filename TEXT,oshi_id TEXT,created_at TEXT);
    CREATE TABLE journal_pages(id TEXT PRIMARY KEY,title TEXT);
    CREATE TABLE journal_items(id TEXT PRIMARY KEY,item_type TEXT,material_id TEXT,material_snapshot TEXT,journal_image_id TEXT,page_id TEXT,style_payload TEXT);
    CREATE TABLE templates(id TEXT PRIMARY KEY,type TEXT,name TEXT,description TEXT,source TEXT,payload TEXT,hidden INTEGER DEFAULT 0,deleted INTEGER DEFAULT 0,created_at TEXT DEFAULT '',updated_at TEXT DEFAULT '');
    CREATE TABLE illustrations(original_path TEXT,thumbnail_path TEXT);
    CREATE TABLE sync_state(key TEXT,value TEXT);
    CREATE TABLE note_images(data_url TEXT);`)
  db={select:async(sql:string,args:SQLInputValue[]=[])=>sqlite.prepare(sql).all(...args),execute:async(sql:string,args:SQLInputValue[]=[])=>sqlite.prepare(sql).run(...args)} as unknown as Database
  shared.getDb.mockResolvedValue(db)
  shared.invoke.mockImplementation(async(command:string,{statements}:{statements:{query:string;values:SQLInputValue[]}[]})=>{
    if(command!=='execute_sync_transaction')throw Error(command)
    sqlite.exec('BEGIN');try{for(const s of statements)sqlite.prepare(s.query).run(...s.values);sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}
  })
  await ensureResourceSchema(db);await reconcileResourceLibrary(db);await loadMaterialLibrary(db)
}
beforeEach(async()=>{
  shared.files.clear();shared.modified.clear();shared.written=''
  vi.stubGlobal('window',{dispatchEvent:vi.fn()})
  vi.stubGlobal('createImageBitmap',async()=>({width:120,height:100,close:()=>{}}))
  await resetDatabase()
})
afterEach(()=>{sqlite.close();vi.unstubAllGlobals()})
function image(name='new.png',data='first'){return new File([data],name,{type:'image/png'})}
function records():SyncRecord[]{return ['resource_assets','resource_versions','journal_items','templates'].flatMap(table=>sqlite.prepare('SELECT * FROM '+table).all().map(row=>({key:`${table}:${row.id}`,table,id:String(row.id),value:row}))) }
describe('imported material lifecycle',()=>{
  it('deletes materials from the library while retaining placed versions across reconciliation and restore',async()=>{
    const id=await importMaterial(image(),'sticker')
    const definition=getJournalMaterialDefinition(id)!
    const snapshot=getMaterialSnapshot(definition)
    sqlite.prepare("INSERT INTO journal_items VALUES ('placed','material',?,?,NULL,'page','{}')").run(id,snapshot)
    const builtin=(await loadMaterialLibrary()).find(item=>item.source==='builtin')!
    await deleteMaterial(id)
    await deleteMaterial(builtin.assetId)
    await reconcileResourceLibrary(db)
    const library=await loadMaterialLibrary()
    expect(library.some(item=>item.id===id||item.id===builtin.id)).toBe(false)
    expect(sqlite.prepare("SELECT material_snapshot FROM journal_items WHERE id='placed'").get()!.material_snapshot).toBe(snapshot)
    expect(resolveMaterialSnapshot(snapshot)?.imagePath).toBe(definition.imagePath)
    expect(shared.files.has(definition.imagePath!)).toBe(true)
    expect(await inspectResourceCleanup()).toEqual([])
    const saved=records()
    expect(()=>validateResourceGraph(saved)).not.toThrow()
    sqlite.close();await resetDatabase()
    for(const record of saved){
      const row=record.value!, columns=Object.keys(row)
      sqlite.prepare(`INSERT INTO ${record.table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.filter(column=>column!=='id').map(column=>`${column}=excluded.${column}`).join(',')}`).run(...Object.values(row) as SQLInputValue[])
    }
    await reconcileResourceLibrary(db)
    expect((await loadMaterialLibrary()).some(item=>item.id===id||item.id===builtin.id)).toBe(false)
    expect(()=>validateResourceGraph(records())).not.toThrow()
  })
  it('keeps placed snapshots and files stable after rename, replacement, archive and restore',async()=>{
    const id=await importMaterial(image(),'sticker')
    const initial=getJournalMaterialDefinition(id)!
    const snapshot=getMaterialSnapshot(initial)
    sqlite.prepare("INSERT INTO journal_items VALUES ('placed','material',?,?,NULL,'page','{}')").run(id,snapshot)
    await updateResource(id,{name:'Renamed',favorite:true,group:'live'})
    expect(getJournalMaterialDefinition(id)?.displayName).toBe('Renamed')
    await importMaterial(image('replacement.png','second'),'sticker',id)
    const current=getJournalMaterialDefinition(id)!
    expect(current.imagePath).not.toBe(initial.imagePath)
    expect(shared.files.has(initial.imagePath!)).toBe(true)
    expect(resolveMaterialSnapshot(snapshot)?.imagePath).toBe(initial.imagePath)
    await updateResource(id,{archived:true})
    expect((await loadMaterialLibrary()).find(m=>m.id===id)?.archived).toBe(true)
    expect(sqlite.prepare("SELECT material_snapshot FROM journal_items WHERE id='placed'").get()!.material_snapshot).toBe(snapshot)
    await updateResource(id,{archived:false})
    expect((await loadMaterialLibrary()).find(m=>m.id===id)?.archived).toBe(false)
    expect(()=>validateResourceGraph(records())).not.toThrow()
  })
  it('rejects unsupported and undecodable files before publishing a resource',async()=>{
    await expect(importMaterial(new File(['svg'],'a.svg',{type:'image/svg+xml'}),'sticker')).rejects.toThrow(/supported/)
    vi.stubGlobal('createImageBitmap',async()=>{throw Error('decode failed')})
    await expect(importMaterial(image(),'sticker')).rejects.toThrow('decode failed')
    expect(shared.files.size).toBe(0)
    expect((await loadMaterialLibrary()).every(m=>m.source==='builtin')).toBe(true)
  })
})
describe('portable packs and template management',()=>{
  it('round-trips a material to a fresh database with the same immutable version and image',async()=>{
    const id=await importMaterial(image(),'sticker')
    const definition=getJournalMaterialDefinition(id)!
    await exportMaterialPack(id,'My sticker')
    const pack=shared.written
    sqlite.close();shared.files.clear();await resetDatabase()
    await importResourcePack(new File([pack],'pack.json'))
    expect(getJournalMaterialDefinition(id)?.resourceVersionId).toBe(definition.resourceVersionId)
    expect(shared.files.has(definition.imagePath!)).toBe(true)
    await importResourcePack(new File([pack],'pack.json'))
    expect(sqlite.prepare("SELECT COUNT(*) n FROM resource_versions WHERE asset_id=?").get(id)!.n).toBe(1)
  })
  it('exports the old version used by a layout after the library image was replaced',async()=>{
    const id=await importMaterial(image(),'sticker'), definition=getJournalMaterialDefinition(id)!
    const payload=JSON.stringify({version:1,layout:{preferredOrientation:'landscape',background:'paper',slots:[],decorations:[{materialId:id,materialSnapshot:getMaterialSnapshot(definition),layout:{x:.1,y:.1,width:.2,height:.2,rotation:0,zIndex:1}}]}})
    const template=await createResourceTemplate({type:'journal_page',name:'Layout',payload})
    await importMaterial(image('new.png','new pixels'),'sticker',id)
    await exportTemplatePack(template,'Layout')
    const pack=shared.written
    expect(JSON.parse(pack).versions[0].id).toBe(definition.resourceVersionId)
    sqlite.close();shared.files.clear();await resetDatabase()
    await importResourcePack(new File([pack],'layout.json'))
    const [restored]=(await fetchResourceTemplates()).filter(t=>t.source==='user')
    expect(JSON.parse(restored.payload).layout.decorations[0].materialSnapshot).toBe(getMaterialSnapshot(definition))
    expect(()=>validateResourceGraph(records())).not.toThrow()
  })
  it('reuses a material template as a separate asset while retaining the original image',async()=>{
    const id=await importMaterial(image(),'sticker'), definition=getJournalMaterialDefinition(id)!
    const copy=await instantiateMaterialTemplate(JSON.stringify({materialSnapshot:getMaterialSnapshot(definition)}),'Reusable sticker')
    expect(copy).not.toBe(id)
    expect(getJournalMaterialDefinition(copy)?.imagePath).toBe(definition.imagePath)
    await updateResource(id,{archived:true})
    expect((await loadMaterialLibrary()).find(m=>m.id===copy)?.archived).toBe(false)
    expect(()=>validateResourceGraph(records())).not.toThrow()
  })
  it('round-trips a configured stamp template with its visual snapshot',async()=>{
    const payload=JSON.stringify({version:1,stamp:{template_id:'recorded',label:'Favourite',color:'#ad8bb5',rotation:8,size:1.2,position:'bottom-right',template_snapshot:'{"version":2,"material_id":"round"}'}})
    const template=await createResourceTemplate({type:'stamp',name:'My stamp',payload})
    await exportTemplatePack(template,'My stamp')
    const pack=shared.written
    sqlite.close();await resetDatabase()
    await importResourcePack(new File([pack],'stamp.json'))
    const [restored]=(await fetchResourceTemplates('stamp')).filter(t=>t.source==='user')
    expect(JSON.parse(restored.payload).stamp).toEqual(JSON.parse(payload).stamp)
  })
  it('rejects tampered bytes, escaping paths, missing dependencies and version collisions without mutation',async()=>{
    const id=await importMaterial(image(),'sticker');await exportMaterialPack(id,'Sticker')
    const valid=shared.written, version=JSON.parse(valid).versions[0]
    const corrupted=JSON.parse(valid);corrupted.files[version.file_path]=btoa('tampered')
    await expect(importResourcePack(new File([JSON.stringify(corrupted)],'x.json'))).rejects.toThrow(/integrity/)
    const escaping=JSON.parse(valid);escaping.versions[0].file_path='media/resources/../../db'
    expect(()=>validatePackShape(escaping)).toThrow(/path/)
    const collision=JSON.parse(valid);collision.versions[0].payload=collision.versions[0].payload.replace('new','changed')
    await expect(importResourcePack(new File([JSON.stringify(collision)],'x.json'))).rejects.toThrow(/collision/)
    const broken=JSON.parse(valid);broken.template={type:'note',name:'Note',description:'',payload:JSON.stringify({resourceDependencies:['missing']})}
    expect(()=>validatePackShape(broken)).toThrow(/dependency/)
    expect(sqlite.prepare("SELECT COUNT(*) n FROM resource_versions WHERE asset_id=?").get(id)!.n).toBe(1)
  })
  it('duplicates built-in layouts and syncs their recycle/restore state without losing their payload',async()=>{
    const builtin=(await fetchResourceTemplates('journal_page'))[0]
    const copy=await duplicateResourceTemplate(builtin,'Custom layout')
    expect(JSON.parse(copy.payload).layout).toBeTruthy()
    await updateResourceTemplate(copy,{name:'Renamed layout',deleted:true})
    expect((await fetchResourceTemplates()).some(t=>t.id===copy.id)).toBe(false)
    const deleted=(await fetchResourceTemplates(undefined,true)).find(t=>t.id===copy.id)!
    expect(deleted.payload).toBe(copy.payload)
    await updateResourceTemplate(deleted,{deleted:false})
    expect((await fetchResourceTemplates()).find(t=>t.id===copy.id)?.name).toBe('Renamed layout')
    await updateResourceTemplate(builtin,{deleted:true})
    expect((await fetchResourceTemplates()).some(t=>t.id===builtin.id)).toBe(false)
    await updateResourceTemplate({...builtin,deleted:true},{deleted:false})
    expect((await fetchResourceTemplates()).some(t=>t.id===builtin.id)).toBe(true)
  })
  it('retires old built-in layouts from pickers while preserving saved custom layouts and legacy resolution', async () => {
    const legacy = getJournalPageTemplateDefinition('quiet-letter')!
    expect(legacy).toBeTruthy()
    await updateResourceTemplate(toResourceTemplate(legacy), { deleted: false })
    const copy = await duplicateResourceTemplate(toResourceTemplate(legacy), 'My saved letter')
    const templates = await fetchResourceTemplates('journal_page', true)
    expect(templates.filter(item => item.source === 'builtin').map(item => item.id)).toEqual(['weekly-reflections-4'])
    expect(templates.some(item => item.id === copy.id)).toBe(true)
    expect(getJournalPageTemplateDefinition('quiet-letter')).toEqual(legacy)
  })
})
describe('reference-aware cleanup',()=>{
  it('retains archived version files and new files; rechecks references before deleting stale candidates',async()=>{
    const id=await importMaterial(image(),'sticker')
    await updateResource(id,{archived:true})
    const path=getJournalMaterialDefinition(id)!.imagePath!
    shared.modified.set(path,Date.now()-172800000)
    const orphan=`media/resources/${crypto.randomUUID()}.png`
    shared.files.set(orphan,new Uint8Array([1]));shared.modified.set(orphan,Date.now()-172800000)
    const fresh=`media/resources/${crypto.randomUUID()}.png`
    shared.files.set(fresh,new Uint8Array([2]));shared.modified.set(fresh,Date.now())
    const candidates=await inspectResourceCleanup()
    expect(candidates.map(c=>c.path)).toEqual([orphan])
    sqlite.prepare("INSERT INTO templates (id,payload) VALUES ('retained',?)").run(JSON.stringify({file:orphan}))
    expect(await cleanResourceFiles(candidates)).toBe(0)
    sqlite.prepare("DELETE FROM templates WHERE id='retained'").run()
    expect(await cleanResourceFiles(candidates)).toBe(1)
    expect(shared.files.has(path)).toBe(true)
    expect(shared.files.has(fresh)).toBe(true)
  })
})
