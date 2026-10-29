import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ handler: undefined as undefined | ((event: { preventDefault: () => void }) => void), listen: vi.fn(), tauri: true }))
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => native.tauri }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ onCloseRequested: native.listen }) }))
beforeEach(() => {
  vi.resetModules(); native.tauri = true; native.handler = undefined
  native.listen.mockReset().mockImplementation(async handler => { native.handler = handler; return () => {} })
})
describe('window close lifecycle', () => {
  it('keeps one live listener, and stops vetoing when the editor unmounts', async () => {
    const service = await import('./windowClose')
    await Promise.all([service.initializeWindowCloseHandling(), service.initializeWindowCloseHandling()])
    expect(native.listen).toHaveBeenCalledTimes(1)
    const event = { preventDefault: vi.fn() }
    native.handler!(event); expect(event.preventDefault).not.toHaveBeenCalled()
    const stop = service.registerWindowCloseGuard(() => true)
    native.handler!(event); expect(event.preventDefault).toHaveBeenCalledTimes(1)
    stop(); native.handler!(event); expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
  it('respects a confirmed discard and initializes again after a document reload', async () => {
    let service = await import('./windowClose')
    let discard = false
    service.registerWindowCloseGuard(() => !discard)
    await service.initializeWindowCloseHandling()
    const event = { preventDefault: vi.fn() }
    native.handler!(event); discard = true; native.handler!(event)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    vi.resetModules(); service = await import('./windowClose')
    await service.initializeWindowCloseHandling()
    native.handler!(event)
    expect(native.listen).toHaveBeenCalledTimes(2)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
})
