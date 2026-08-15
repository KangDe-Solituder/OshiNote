import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { ImageIcon } from 'lucide-react'
import {
  discardCachedMediaUrl,
  getCachedMediaUrlWithFallback,
  releaseMediaUrl,
  resolveMediaUrlWithFallback,
} from '../../services/media/illustrationMedia'

interface MediaImageProps {
  path: string | null
  fallbackPath?: string | null
  alt: string
  className?: string
  reserveHeight?: boolean
  eager?: boolean
  draggable?: boolean
  onLoad?: () => void
}

/**
 * Shared media image: resolves AppData files through the blob-URL LRU cache,
 * fades in on load, and walks the fallback chain on error.
 */
export function MediaImage({
  path,
  fallbackPath,
  alt,
  className,
  reserveHeight = true,
  eager = false,
  draggable = false,
  onLoad,
}: MediaImageProps) {
  const candidates = useMemo(
    () => Array.from(new Set([path, fallbackPath].filter((candidate): candidate is string => Boolean(candidate)))),
    [fallbackPath, path]
  )
  const [src, setSrc] = useState(() => getCachedMediaUrlWithFallback(path, fallbackPath))
  const [sourceIndex, setSourceIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setSourceIndex(0)
    setFailed(false)
    setLoaded(false)
    setSrc(getCachedMediaUrlWithFallback(candidates[0], candidates[1]))
  }, [candidates])

  useEffect(() => {
    let alive = true
    setSrc(getCachedMediaUrlWithFallback(candidates[sourceIndex], candidates[sourceIndex + 1]))
    let currentUrl = ''
    resolveMediaUrlWithFallback(candidates[sourceIndex], candidates[sourceIndex + 1])
      .then((url) => {
        if (!url) throw new Error('Media file not found')
        currentUrl = url
        if (alive) setSrc(url)
        else releaseMediaUrl(url)
      })
      .catch(() => {
        if (!alive) return
        if (sourceIndex < candidates.length - 1) {
          setSourceIndex((index) => index + 1)
        } else {
          setFailed(true)
        }
      })
    return () => {
      alive = false
      releaseMediaUrl(currentUrl)
    }
  }, [candidates, sourceIndex])

  function handleImageError() {
    discardCachedMediaUrl(src)
    if (sourceIndex < candidates.length - 1) {
      setSourceIndex((index) => index + 1)
      return
    }
    setFailed(true)
    setSrc('')
  }

  if (!src || failed) {
    return (
      <div className={clsx('flex items-center justify-center bg-bg-tertiary text-text-muted', reserveHeight && 'min-h-48', className)}>
        {failed && <ImageIcon size={26} />}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={clsx(
        'bg-bg-tertiary transition-opacity duration-300',
        loaded ? 'opacity-100' : 'opacity-0',
        className
      )}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={draggable}
      ref={(el) => {
        if (el?.complete && el.naturalWidth > 0) setLoaded(true)
      }}
      onLoad={() => {
        setLoaded(true)
        onLoad?.()
      }}
      onError={handleImageError}
    />
  )
}
