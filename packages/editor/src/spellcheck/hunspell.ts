import { DICTIONARIES } from './dictionaries'

export interface SpellChecker {
  check(word: string): boolean
  suggest(word: string): string[]
}

/**
 * In-memory dictionary: Set-based word lookup.
 * Production: load from .dic file; tests: use fixture words.
 */
class SimpleSpellChecker implements SpellChecker {
  private words: Set<string>
  private customWords: Set<string>

  constructor(words: string[]) {
    this.words = new Set(words.map(w => w.toLowerCase().trim()).filter(Boolean))
    this.customWords = new Set()
  }

  check(word: string): boolean {
    const lower = word.toLowerCase()
    return this.words.has(lower) || this.customWords.has(lower)
  }

  suggest(_word: string): string[] {
    // Minimal: return empty (full Hunspell suggestions require .aff parsing)
    return []
  }

  addCustomWord(word: string) {
    this.customWords.add(word.toLowerCase())
  }
}

// Cache: lang → checker
const checkerCache = new Map<string, SpellChecker>()

// Custom words per-project (in-memory; production uses IndexedDB)
const customWords = new Map<string, Set<string>>()

/**
 * Load a dictionary for the given language.
 * In production: fetches .dic file, parses word list.
 * In test/jsdom: fetch will fail gracefully, returning an empty checker.
 */
export async function loadDictionary(lang: string): Promise<SpellChecker> {
  if (checkerCache.has(lang)) {
    return checkerCache.get(lang)!
  }

  const manifest = DICTIONARIES[lang]
  if (!manifest) {
    // Fallback: empty checker for unknown language codes
    const checker = new SimpleSpellChecker([])
    checkerCache.set(lang, checker)
    return checker
  }

  try {
    // Fetch .dic file (word list, one per line)
    const response = await fetch(manifest.dic)
    if (!response.ok) throw new Error(`Failed to load dictionary: ${manifest.dic}`)
    const text = await response.text()
    const words = text.split('\n').filter(Boolean)
    const checker = new SimpleSpellChecker(words)

    // Apply any cached custom words
    const custom = customWords.get(lang)
    if (custom) {
      for (const w of custom) checker.addCustomWord(w)
    }

    checkerCache.set(lang, checker)
    return checker
  } catch {
    // Network unavailable (expected in dev/CI without dict files)
    const checker = new SimpleSpellChecker([])
    checkerCache.set(lang, checker)
    return checker
  }
}

/**
 * Add a word to the custom dictionary for a language.
 * Persists in-memory; production would write to IndexedDB.
 */
export function addToCustomDictionary(lang: string, word: string) {
  if (!customWords.has(lang)) customWords.set(lang, new Set())
  customWords.get(lang)!.add(word.toLowerCase())

  // Update cached checker if loaded
  const checker = checkerCache.get(lang) as SimpleSpellChecker | undefined
  if (checker) checker.addCustomWord(word)
}

/**
 * Create a spell checker from a word list (for testing).
 */
export function createCheckerFromWords(words: string[]): SpellChecker {
  return new SimpleSpellChecker(words)
}

/**
 * Clear cached checkers (for testing).
 */
export function clearCheckerCache() {
  checkerCache.clear()
  customWords.clear()
}
