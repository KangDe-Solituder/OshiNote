import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fsMocks = vi.hoisted(() => ({
  exists: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => true) }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 1 },
  ...fsMocks,
}))

import { storeCustomBackground } from './backgroundImage'

describe('storeCustomBackground', () => {
  beforeEach(() => {
    fsMocks.exists.mockReset().mockResolvedValue(true)
    fsMocks.mkdir.mockReset().mockResolvedValue(undefined)
    fsMocks.remove.mockReset().mockResolvedValue(undefined)
    fsMocks.writeFile.mockReset().mockResolvedValue(undefined)
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn()
        .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
        .mockReturnValueOnce('22222222-2222-4222-8222-222222222222'),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('uses a new path and removes the previous managed background', async () => {
    const file = {
      type: 'image/jpeg',
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as File

    const firstPath = await storeCustomBackground(file)
    const secondPath = await storeCustomBackground(file, firstPath)

    expect(firstPath).not.toBe(secondPath)
    expect(firstPath).toMatch(/^media\/background\/custom-background-[a-f0-9]+\.jpg$/)
    expect(secondPath).toMatch(/^media\/background\/custom-background-[a-f0-9]+\.jpg$/)
    expect(fsMocks.remove).toHaveBeenCalledWith(firstPath, { baseDir: 1 })
  })

  it('rejects unsupported image types before writing a file', async () => {
    const file = {
      type: 'image/svg+xml',
      arrayBuffer: async () => new ArrayBuffer(0),
    } as File

    await expect(storeCustomBackground(file)).rejects.toThrow('Unsupported background image type')
    expect(fsMocks.writeFile).not.toHaveBeenCalled()
  })
})
