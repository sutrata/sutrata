import { devanagariTable } from './translit-tables/devanagari.js'
import { tamilTable } from './translit-tables/tamil.js'
import { teluguTable } from './translit-tables/telugu.js'
import { kannadaTable } from './translit-tables/kannada.js'
import { malayalamTable } from './translit-tables/malayalam.js'
import { bengaliTable } from './translit-tables/bengali.js'
import { gujaratiTable } from './translit-tables/gujarati.js'
import { gurmukhiTable } from './translit-tables/gurmukhi.js'
import { odiaTable } from './translit-tables/odia.js'

export type Script =
  | 'devanagari'
  | 'tamil'
  | 'telugu'
  | 'kannada'
  | 'malayalam'
  | 'bengali'
  | 'gujarati'
  | 'gurmukhi'
  | 'odia'

const TABLES: Record<Script, Record<string, string>> = {
  devanagari: devanagariTable,
  tamil: tamilTable,
  telugu: teluguTable,
  kannada: kannadaTable,
  malayalam: malayalamTable,
  bengali: bengaliTable,
  gujarati: gujaratiTable,
  gurmukhi: gurmukhiTable,
  odia: odiaTable,
}

// Sorted keys longest-first for greedy matching
const SORTED_KEYS: Record<Script, string[]> = {} as Record<Script, string[]>

for (const script of Object.keys(TABLES) as Script[]) {
  SORTED_KEYS[script] = Object.keys(TABLES[script])
    .filter(k => !k.endsWith('_sign')) // exclude internal _sign keys
    .sort((a, b) => b.length - a.length) // longest first
}

/**
 * Transliterate romanized text to the target Indic script.
 * Uses greedy longest-match: at each position, tries the longest matching key.
 * Characters that don't match any key are passed through unchanged.
 *
 * @param roman - Romanized input (ISO 15919 / ITRANS-style)
 * @param script - Target script name
 * @returns Native script text
 */
export function transliterate(roman: string, script: Script): string {
  const table = TABLES[script]
  const keys = SORTED_KEYS[script]
  if (!table || !keys) return roman

  let result = ''
  let i = 0

  while (i < roman.length) {
    let matched = false

    for (const key of keys) {
      if (roman.startsWith(key, i)) {
        result += table[key]
        i += key.length
        matched = true
        break
      }
    }

    if (!matched) {
      result += roman[i]
      i++
    }
  }

  return result
}
