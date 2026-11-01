export type JournalExportStage = 'render' | 'dialog' | 'write'

export function describeExportError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof error === 'string') return error
  try { return JSON.stringify(error) || String(error) } catch { return String(error) }
}

export class JournalExportError extends Error {
  readonly stage: JournalExportStage

  constructor(stage: JournalExportStage, cause: unknown) {
    super(describeExportError(cause), { cause })
    this.name = 'JournalExportError'
    this.stage = stage
  }
}
