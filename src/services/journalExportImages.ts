/** Make images self-contained before SVG/foreignObject rendering. In the desktop
 * app blob URLs can be displayed by img-src, but fetching them again is blocked
 * by connect-src. Read decoded pixels instead; keep the live page untouched. */
export async function embedJournalExportImages(clone: HTMLElement): Promise<void> {
  for (const image of Array.from(clone.querySelectorAll('img'))) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const src = image.currentSrc || image.src
      if (!src) throw new Error('Image source is missing')
      image.removeAttribute('srcset')
      image.removeAttribute('sizes')
      image.loading = 'eager'
      image.src = src
      await Promise.race([
        image.decode(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Image decoding timed out')), 15000)
        }),
      ])
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Image has no pixels')
      if (!src.startsWith('data:')) {
        const canvas = clone.ownerDocument.createElement('canvas')
        try {
          canvas.width = image.naturalWidth
          canvas.height = image.naturalHeight
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Image canvas is unavailable')
          context.drawImage(image, 0, 0)
          const embedded = canvas.toDataURL('image/png')
          if (!embedded.startsWith('data:image/png')) throw new Error('Image encoding failed')
          image.src = embedded
          await image.decode()
        } finally {
          canvas.width = canvas.height = 0
        }
      }
      // React's onLoad handler is not copied by cloneNode. Complete its loading
      // fade in the export copy without changing deliberate inline opacity.
      image.classList.remove('opacity-0', 'transition-opacity')
    } catch (cause) {
      throw new Error(`Could not embed image "${image.alt || 'unnamed image'}": ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
    } finally {
      clearTimeout(timer)
    }
  }
}
