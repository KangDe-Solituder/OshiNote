// Keep imports, sync file activation and cleanup from racing in this application session.
let pending: Promise<unknown> = Promise.resolve()
export function withResourceFiles<T>(work: () => Promise<T>): Promise<T> {
  const result = pending.then(work, work)
  pending = result.then(() => undefined, () => undefined)
  return result
}
