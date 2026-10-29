import { expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({fetch:vi.fn()}))
vi.mock('../features/notes/noteService',()=>({fetchNotesByOshi:mocks.fetch}))
import {useNoteStore} from './noteStore'
it('ignores an older Oshi response after a newer search succeeds',async()=>{
 let old!: (value: unknown)=>void
 mocks.fetch.mockImplementationOnce(()=>new Promise(resolve=>{old=resolve})).mockResolvedValueOnce({notes:[{id:'new'}],total:1})
 const params={page:1,pageSize:20,query:''}
 const pending=useNoteStore.getState().fetchByOshi('old',params)
 await useNoteStore.getState().fetchByOshi('new',{...params,query:'latest'})
 old({notes:[{id:'old'}],total:99});await pending
 expect(useNoteStore.getState().notes).toEqual([{id:'new'}]);expect(useNoteStore.getState().totalNotes).toBe(1)
})
