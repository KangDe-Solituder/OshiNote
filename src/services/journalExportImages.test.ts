import { describe, expect, it, vi } from 'vitest'
import { embedJournalExportImages } from './journalExportImages'

function fixture(src = 'blob:local-image') {
  const image = {
    currentSrc: src, src, alt: 'photo.png', naturalWidth: 640, naturalHeight: 480,
    decode: vi.fn().mockResolvedValue(undefined), removeAttribute: vi.fn(),
    classList: { remove: vi.fn() }, loading: 'lazy',
  }
  const context = { drawImage: vi.fn() }
  const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: vi.fn(() => 'data:image/png;base64,AAAA') }
  const clone = { querySelectorAll: () => [image], ownerDocument: { createElement: vi.fn(() => canvas) } }
  return { image, context, canvas, clone: clone as unknown as HTMLElement }
}

describe('journal export images', () => {
  it('embeds blob pixels without fetching and clears cloned loading state', async () => {
    const { image, context, canvas, clone } = fixture()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('CSP blocked'))
    try {
      await embedJournalExportImages(clone)
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0)
      expect(image.src).toBe('data:image/png;base64,AAAA')
      expect(image.loading).toBe('eager')
      expect(image.removeAttribute).toHaveBeenCalledWith('srcset')
      expect(image.classList.remove).toHaveBeenCalledWith('opacity-0', 'transition-opacity')
      expect(canvas.width).toBe(0)
    } finally { fetchSpy.mockRestore() }
  })

  it('keeps existing data images without re-encoding', async () => {
    const { image, canvas, clone } = fixture('data:image/webp;base64,AAAA')
    await embedJournalExportImages(clone)
    expect(image.decode).toHaveBeenCalled()
    expect(canvas.toDataURL).not.toHaveBeenCalled()
    expect(image.src).toBe('data:image/webp;base64,AAAA')
  })

  it('reports the file name instead of silently exporting broken images', async () => {
    const { image, clone } = fixture()
    image.decode.mockRejectedValue(new Error('Invalid image'))
    await expect(embedJournalExportImages(clone)).rejects.toThrow('photo.png')
  })

  it('rejects a failed canvas encoding instead of embedding an empty image', async () => {
    const { canvas, clone } = fixture()
    canvas.toDataURL.mockReturnValue('data:,')
    await expect(embedJournalExportImages(clone)).rejects.toThrow('Image encoding failed')
    expect(canvas.width).toBe(0)
  })
})
