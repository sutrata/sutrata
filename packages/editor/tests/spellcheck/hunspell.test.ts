import { describe, it, expect, beforeEach } from 'vitest'
import { createCheckerFromWords, addToCustomDictionary, clearCheckerCache, loadDictionary } from '../../src/spellcheck/hunspell'

describe('hunspell', () => {
  beforeEach(() => {
    clearCheckerCache()
  })

  describe('createCheckerFromWords (fixture dictionary)', () => {
    it('check returns true for known words', () => {
      const checker = createCheckerFromWords(['hello', 'world', 'screenplay'])
      expect(checker.check('hello')).toBe(true)
      expect(checker.check('world')).toBe(true)
    })

    it('check returns false for unknown words', () => {
      const checker = createCheckerFromWords(['hello', 'world'])
      expect(checker.check('xyzzy')).toBe(false)
    })

    it('check is case-insensitive', () => {
      const checker = createCheckerFromWords(['hello'])
      expect(checker.check('Hello')).toBe(true)
      expect(checker.check('HELLO')).toBe(true)
    })

    it('suggest returns an array', () => {
      const checker = createCheckerFromWords(['hello'])
      const suggestions = checker.suggest('helo')
      expect(Array.isArray(suggestions)).toBe(true)
    })
  })

  describe('addToCustomDictionary', () => {
    it('custom words pass check after being added', () => {
      const checker = createCheckerFromWords(['hello'])
      expect(checker.check('screenplay')).toBe(false)

      // Add directly via the internal method (the checker is a SimpleSpellChecker)
      ;(checker as any).addCustomWord('screenplay')
      expect(checker.check('screenplay')).toBe(true)
    })

    it('addToCustomDictionary updates a cached checker', async () => {
      // Prime the cache with an empty checker for lang 'en-test'
      const cached = await loadDictionary('xx-custom')
      expect(cached.check('screenplay')).toBe(false)

      addToCustomDictionary('xx-custom', 'screenplay')
      expect(cached.check('screenplay')).toBe(true)
    })
  })

  describe('loadDictionary', () => {
    it('returns a SpellChecker for a known language even with no dict file', async () => {
      const checker = await loadDictionary('en')
      expect(checker).toBeDefined()
      expect(typeof checker.check).toBe('function')
      expect(typeof checker.suggest).toBe('function')
    })

    it('caches the checker on second call', async () => {
      const checker1 = await loadDictionary('ta')
      const checker2 = await loadDictionary('ta')
      expect(checker1).toBe(checker2) // same reference
    })

    it('returns empty checker for unknown language code', async () => {
      const checker = await loadDictionary('xx')
      expect(checker.check('anything')).toBe(false)
    })

    it('returns a checker with check and suggest for all manifest languages', async () => {
      for (const lang of ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'bn', 'gu', 'pa', 'or']) {
        clearCheckerCache()
        const checker = await loadDictionary(lang)
        expect(typeof checker.check).toBe('function')
        expect(typeof checker.suggest).toBe('function')
      }
    })
  })
})
