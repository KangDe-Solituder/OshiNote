import { describe, expect, it } from 'vitest'
import { getJournalExportFontCSS } from './journalExportFonts'

function documentWith(sheets: unknown[]): Document {
  return { styleSheets: sheets, baseURI: 'http://localhost/' } as unknown as Document
}

describe('journal export fonts', () => {
  it('bypasses automatic collection even without custom fonts or a usable detached document', async () => {
    const css = await getJournalExportFontCSS(documentWith([{ cssRules: null }]))
    expect(css).toBeTruthy()
    expect(css).not.toContain('@font-face')
  })

  it('preserves embedded stamp fonts inside grouped and imported styles', async () => {
    const face = { type: 5, cssText: '@font-face { font-family: "OshiNote Great Vibes"; src: url("data:font/ttf;base64,AAAA"); }' }
    const sheet = { cssRules: [{ type: 4, cssRules: [face] }] }
    const css = await getJournalExportFontCSS(documentWith([{ cssRules: [{ type: 3, styleSheet: sheet }] }, sheet]))
    expect(css).toContain('OshiNote Great Vibes')
    expect(css).toContain('data:font/ttf;base64,AAAA')
    expect(css.match(/@font-face/g)).toHaveLength(1)
  })

  it('skips inaccessible stylesheets and null imported sheets', async () => {
    const blocked = { get cssRules() { throw new DOMException('Blocked', 'SecurityError') } }
    await expect(getJournalExportFontCSS(documentWith([blocked, { cssRules: [{ type: 3, styleSheet: null }] }]))).resolves.toBeTruthy()
  })
})
