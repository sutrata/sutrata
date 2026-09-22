// Detect the dominant script/language from a text run using Unicode blocks
// Returns BCP-47 language code: 'hi', 'ta', 'te', 'kn', 'ml', 'bn', 'gu', 'pa', 'or', 'si', 'en'

interface ScriptRange {
  name: string
  lang: string
  start: number
  end: number
}

// Unicode block ranges for each script (start–end inclusive codepoint)
const SCRIPT_RANGES: ScriptRange[] = [
  // Devanagari: U+0900–U+097F
  { name: 'Devanagari', lang: 'hi', start: 0x0900, end: 0x097f },
  // Bengali: U+0980–U+09FF
  { name: 'Bengali', lang: 'bn', start: 0x0980, end: 0x09ff },
  // Gurmukhi: U+0A00–U+0A7F
  { name: 'Gurmukhi', lang: 'pa', start: 0x0a00, end: 0x0a7f },
  // Gujarati: U+0A80–U+0AFF
  { name: 'Gujarati', lang: 'gu', start: 0x0a80, end: 0x0aff },
  // Odia: U+0B00–U+0B7F
  { name: 'Odia', lang: 'or', start: 0x0b00, end: 0x0b7f },
  // Tamil: U+0B80–U+0BFF
  { name: 'Tamil', lang: 'ta', start: 0x0b80, end: 0x0bff },
  // Telugu: U+0C00–U+0C7F
  { name: 'Telugu', lang: 'te', start: 0x0c00, end: 0x0c7f },
  // Kannada: U+0C80–U+0CFF
  { name: 'Kannada', lang: 'kn', start: 0x0c80, end: 0x0cff },
  // Malayalam: U+0D00–U+0D7F
  { name: 'Malayalam', lang: 'ml', start: 0x0d00, end: 0x0d7f },
  // Sinhala: U+0D80–U+0DFF
  { name: 'Sinhala', lang: 'si', start: 0x0d80, end: 0x0dff },
  // Latin: U+0000–U+007F, U+0100–U+017F (Latin Extended-A, etc.)
  { name: 'Latin', lang: 'en', start: 0x0000, end: 0x007f },
  { name: 'Latin Extended', lang: 'en', start: 0x0100, end: 0x017f },
]

export function detectScript(text: string): string {
  if (!text || text.length === 0) return 'en'

  // Count codepoints in each script
  const scriptCounts: Record<string, number> = {}

  for (const char of text) {
    const code = char.charCodeAt(0)

    // Skip common symbols, whitespace, punctuation (treat as neutral)
    if (code <= 0x007f && (code < 0x0041 || (code > 0x005a && code < 0x0061) || code > 0x007a)) {
      continue // punctuation, spaces, numbers
    }

    // Find matching script range
    for (const range of SCRIPT_RANGES) {
      if (code >= range.start && code <= range.end) {
        scriptCounts[range.lang] = (scriptCounts[range.lang] ?? 0) + 1
        break
      }
    }
  }

  // Find the dominant script
  let dominantLang = 'en'
  let maxCount = 0

  for (const [lang, count] of Object.entries(scriptCounts)) {
    if (count > maxCount) {
      dominantLang = lang
      maxCount = count
    }
  }

  return dominantLang
}
