import { useEffect, useState } from 'react'

export function useResourcePagination<T>(items: T[], filterKey: string) {
  const [size, setSize] = useState(12)
  const [position, setPosition] = useState({ key: filterKey, page: 1 })
  useEffect(() => { setPosition({ key: filterKey, page: 1 }) }, [filterKey])
  const totalPages = Math.max(1, Math.ceil(items.length / size))
  const page = Math.min(totalPages, position.key === filterKey ? position.page : 1)
  const setPage = (next: number) => setPosition({ key: filterKey, page: Math.max(1, Math.min(totalPages, next)) })
  return {
    page, size, totalPages, total: items.length,
    visible: items.slice((page - 1) * size, page * size),
    setPage,
    setSize: (next: number) => { setSize(next); setPage(1) },
  }
}

