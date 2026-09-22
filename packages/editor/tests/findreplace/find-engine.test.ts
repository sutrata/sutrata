import { describe, it, expect } from 'vitest'
import { findAll, replaceAll, replaceInRange } from '../../src/findreplace/find-engine'

describe('find-engine', () => {
  describe('findAll', () => {
    it('finds all occurrences of a query', () => {
      const matches = findAll('hello world hello', 'hello')
      expect(matches.length).toBe(2)
      expect(matches[0].start).toBe(0)
      expect(matches[1].start).toBe(12)
    })

    it('is case-sensitive by default', () => {
      const matches = findAll('Hello HELLO hello', 'hello')
      expect(matches.length).toBe(1)
      expect(matches[0].start).toBe(12)
    })

    it('case-insensitive mode finds all case variants', () => {
      const matches = findAll('Hello HELLO hello', 'hello', { caseSensitive: false })
      expect(matches.length).toBe(3)
    })

    it('handles NFC-normalized Devanagari text', () => {
      // "नमस्ते" — NFC is the canonical form
      const text = 'नमस्ते नमस्ते'
      const matches = findAll(text, 'नमस्ते')
      expect(matches.length).toBe(2)
    })

    it('returns empty for no matches', () => {
      expect(findAll('abc', 'xyz').length).toBe(0)
    })

    it('returns empty for empty query', () => {
      expect(findAll('abc', '').length).toBe(0)
    })

    it('case-insensitivity is silent no-op for Devanagari (caseless script)', () => {
      // Should not throw; just find exact matches
      const matches = findAll('नमस्ते', 'नमस्ते', { caseSensitive: false })
      expect(matches.length).toBe(1)
    })

    it('matches NFC-equivalent strings (NFC normalization)', () => {
      // Compose "é" two ways: precomposed NFC (U+00E9) vs NFD decomposed (e + combining accent)
      const precomposed = 'é'  // NFC é
      const decomposed  = 'é' // NFD é
      expect(precomposed.normalize('NFC')).toBe(decomposed.normalize('NFC'))
      const matches = findAll('café', decomposed)
      expect(matches.length).toBe(1)
    })
  })

  describe('replaceAll', () => {
    it('replaces all occurrences', () => {
      const result = replaceAll('foo bar foo baz', 'foo', 'qux')
      expect(result).toBe('qux bar qux baz')
    })

    it('returns original text when no matches', () => {
      expect(replaceAll('abc', 'xyz', 'qux')).toBe('abc')
    })

    it('replaces Devanagari text', () => {
      const result = replaceAll('राम राम राम', 'राम', 'श्याम')
      expect(result).toBe('श्याम श्याम श्याम')
    })
  })

  describe('replaceInRange', () => {
    it('replaces only within the specified range', () => {
      const text = 'abc foo abc foo abc'
      // Range covers 'foo abc foo' starting at index 4
      const result = replaceInRange(text, 'foo', 'bar', 4, 15)
      expect(result).toBe('abc bar abc bar abc')
    })

    it('does not modify text outside the range', () => {
      const text = 'foo abc foo'
      const result = replaceInRange(text, 'foo', 'bar', 4, 11)
      expect(result.startsWith('foo')).toBe(true)
      expect(result).toContain('bar')
    })
  })
})
