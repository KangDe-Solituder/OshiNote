import { describe, expect, it } from 'vitest'
import { describeExportError, JournalExportError } from './journalExportError'

describe('journal export diagnostics', () => {
  it('retains the stage and original exception', () => {
    const cause = new DOMException('Access denied', 'SecurityError')
    const error = new JournalExportError('render', cause)
    expect(error.stage).toBe('render')
    expect(error.cause).toBe(cause)
    expect(error.message).toBe('SecurityError: Access denied')
  })
  it('preserves native plugin string and structured errors', () => {
    expect(new JournalExportError('dialog', 'dialog.save not allowed').message).toContain('dialog.save not allowed')
    expect(describeExportError({ code: 'EACCES' })).toBe('{"code":"EACCES"}')
  })
})
