/** Supply font CSS explicitly: modern-screenshot's automatic collector dereferences
 * a detached document's style.sheet, which can be null in WebView2. */
export async function getJournalExportFontCSS(doc: Document): Promise<string> {
  const fonts: Array<{ css: string; base: string }> = []
  const visited = new Set<CSSStyleSheet>()
  function visitSheet(sheet: CSSStyleSheet) {
    if (visited.has(sheet)) return
    visited.add(sheet)
    let rules: CSSRuleList
    try { rules = sheet.cssRules } catch { return } // Cross-origin sheets are not readable.
    if (rules) visitRules(rules, sheet.href || doc.baseURI)
  }
  function visitRules(rules: CSSRuleList, base: string) {
    for (const rule of Array.from(rules)) {
      if (rule.type === 5) fonts.push({ css: rule.cssText, base }) // FONT_FACE_RULE
      else if (rule.type === 3) {
        const imported = (rule as CSSImportRule).styleSheet
        if (imported) visitSheet(imported)
      } else if ('cssRules' in rule) {
        const nested = (rule as CSSGroupingRule).cssRules
        if (nested) visitRules(nested, base)
      }
    }
  }
  Array.from(doc.styleSheets).forEach(visitSheet)
  const cache = new Map<string, Promise<string>>()
  async function embed(url: string): Promise<string> {
    if (url.startsWith('data:')) return url
    let pending = cache.get(url)
    if (!pending) {
      pending = (async () => {
        const response = await fetch(url, { cache: 'force-cache' })
        if (!response.ok) throw new Error(`Could not embed export font (${response.status})`)
        const blob = await response.blob()
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(reader.error || new Error('Could not read export font'))
          reader.readAsDataURL(blob)
        })
      })()
      cache.set(url, pending)
    }
    return pending
  }
  const result: string[] = []
  for (const font of fonts) {
    let css = font.css
    for (const match of font.css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)) {
      const url = new URL(match[2], font.base).href
      css = css.replace(match[0], `url("${await embed(url)}")`)
    }
    result.push(css)
  }
  // A nonempty cssText also bypasses the collector when no custom fonts exist.
  return result.join('\n') || '/* This page uses system fonts. */'
}
