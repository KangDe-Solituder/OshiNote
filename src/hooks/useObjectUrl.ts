import { useEffect, useState } from 'react'

export function useObjectUrl(createUrl: () => Promise<string>, deps: readonly unknown[]): string {
  const [url, setUrl] = useState('')

  useEffect(() => {
    let alive = true
    let currentUrl = ''
    createUrl()
      .then((nextUrl) => {
        currentUrl = nextUrl
        if (alive) setUrl(nextUrl)
        else URL.revokeObjectURL(nextUrl)
      })
      .catch(() => {
        if (alive) setUrl('')
      })

    return () => {
      alive = false
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return url
}
