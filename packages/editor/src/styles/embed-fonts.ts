/**
 * Embeds self-hosted @font-face rules (from shell/fonts/fonts.css, already loaded into
 * the running app's own document) as data: URIs, for splicing into the PDF/print-preview
 * HTML — a separate, standalone document that never sees the app's own stylesheets.
 *
 * Introspects the CSSOM (`document.styleSheets`) rather than hardcoding filenames/unicode
 * ranges per family: whatever fonts.css declares for a family is exactly what gets embedded,
 * so this can never drift out of sync with the actual font files bundled in public/fonts.
 *
 * Why embed at all instead of just linking `/fonts/...` from the print HTML: the native
 * desktop PDF export writes the HTML to a temp file and loads it via a `file://` URL in a
 * hidden webview, which cannot resolve a root-relative `/fonts/...` path back to the running
 * app's own server/origin. A data: URI works regardless of the HTML's own location.
 */

function urlToDataUri(url: string): Promise<string> {
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to fetch font: ${url}`)
      return res.blob()
    })
    .then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    }))
}

function findFontFaceRules(familyName: string): CSSFontFaceRule[] {
  const rules: CSSFontFaceRule[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList
    try {
      cssRules = sheet.cssRules
    } catch {
      continue // cross-origin stylesheets throw on access; nothing we bundle is cross-origin
    }
    for (const rule of Array.from(cssRules)) {
      if (rule instanceof CSSFontFaceRule) {
        const family = rule.style.getPropertyValue('font-family').replace(/^['"]|['"]$/g, '')
        if (family === familyName) rules.push(rule)
      }
    }
  }
  return rules
}

/** Builds `@font-face` CSS text embedding every self-hosted rule for the given family
 *  names, as data: URIs. Families with no matching rules (e.g. web-safe fonts that were
 *  never in fonts.css) are silently skipped — the Google Fonts `<link>`/generic fallback
 *  stack in print-adapter.ts's font stack still applies. Fetch failures for an individual
 *  rule are likewise skipped rather than failing the whole export. */
export async function embedFontFacesFor(familyNames: string[]): Promise<string> {
  const blocks: string[] = []
  for (const family of familyNames) {
    for (const rule of findFontFaceRules(family)) {
      const srcRaw = rule.style.getPropertyValue('src')
      const match = /url\(["']?([^"')]+)["']?\)/.exec(srcRaw)
      if (!match) continue
      try {
        const dataUri = await urlToDataUri(match[1]!)
        const weight = rule.style.getPropertyValue('font-weight') || '400'
        const style = rule.style.getPropertyValue('font-style') || 'normal'
        const unicodeRange = rule.style.getPropertyValue('unicode-range')
        blocks.push(
          '@font-face {\n' +
          `  font-family: '${family}';\n` +
          `  font-weight: ${weight};\n` +
          `  font-style: ${style};\n` +
          `  src: url(${dataUri}) format('woff2');\n` +
          (unicodeRange ? `  unicode-range: ${unicodeRange};\n` : '') +
          '}'
        )
      } catch {
        // Skip; the Google Fonts link / generic fallback stack still covers this family.
      }
    }
  }
  return blocks.join('\n')
}
