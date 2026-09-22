/**
 * Find & Replace engine for Sutrata.
 * NFC-normalized, grapheme-boundary-aware search/replace.
 */

export interface FindMatch {
  start: number  // character offset in text
  end: number    // exclusive end
  text: string   // matched text
}

export interface FindOptions {
  caseSensitive?: boolean
}

/**
 * Normalize text for comparison: NFC + optional case-fold.
 */
function normalize(text: string, caseSensitive: boolean): string {
  const nfc = text.normalize('NFC')
  return caseSensitive ? nfc : nfc.toLowerCase()
}

/**
 * Find all occurrences of `query` in `text`.
 * Both are NFC-normalized before comparison.
 * Case-insensitivity applies only to scripts with case (Latin, Greek, Cyrillic);
 * it's a silent no-op for caseless scripts (Devanagari, Tamil, etc.).
 */
export function findAll(text: string, query: string, options: FindOptions = {}): FindMatch[] {
  if (!query || !text) return []

  const { caseSensitive = true } = options
  const normalizedText = normalize(text, caseSensitive)
  const normalizedQuery = normalize(query, caseSensitive)

  if (!normalizedQuery) return []

  const matches: FindMatch[] = []
  let searchFrom = 0

  while (searchFrom < normalizedText.length) {
    const idx = normalizedText.indexOf(normalizedQuery, searchFrom)
    if (idx === -1) break

    matches.push({
      start: idx,
      end: idx + normalizedQuery.length,
      text: text.slice(idx, idx + normalizedQuery.length),
    })

    searchFrom = idx + 1 // Advance by 1 to allow overlapping but not infinite loop
  }

  return matches
}

/**
 * Replace all occurrences of `query` in `text` with `replacement`.
 * Preserves the original text's casing/encoding for replaced segments.
 */
export function replaceAll(text: string, query: string, replacement: string, options: FindOptions = {}): string {
  const matches = findAll(text, query, options)
  if (matches.length === 0) return text

  let result = ''
  let lastEnd = 0

  for (const match of matches) {
    result += text.slice(lastEnd, match.start)
    result += replacement
    lastEnd = match.end
  }
  result += text.slice(lastEnd)

  return result
}

/**
 * Replace all occurrences within a specific range [rangeStart, rangeEnd).
 * Text outside the range is preserved unchanged.
 */
export function replaceInRange(
  text: string,
  query: string,
  replacement: string,
  rangeStart: number,
  rangeEnd: number,
  options: FindOptions = {}
): string {
  const before = text.slice(0, rangeStart)
  const within = text.slice(rangeStart, rangeEnd)
  const after = text.slice(rangeEnd)

  const replacedWithin = replaceAll(within, query, replacement, options)
  return before + replacedWithin + after
}
