import { describe, it, expect } from 'vitest'
import { transliterate } from '../src/transliterate'

describe('transliterate', () => {
  it('transliterates "namaste" to Devanagari', () => {
    // namaste = n+a+m+a+s+t+e → नमस्ते
    // n→न, a→अ, m→म, a→अ, s→स, t→त, e→ए
    const result = transliterate('namaste', 'devanagari')
    expect(result).toContain('न')
    expect(result).toContain('म')
    expect(result).toContain('स')
    expect(result).toContain('त')
  })

  it('handles Devanagari consonant+vowel: "ka"', () => {
    const result = transliterate('ka', 'devanagari')
    expect(result).toContain('क') // k → क
    expect(result).toContain('अ') // a → अ
  })

  it('handles Tamil: "ka"', () => {
    const result = transliterate('ka', 'tamil')
    expect(result).toContain('க')
    expect(result).toContain('அ')
  })

  it('handles Telugu: "ka"', () => {
    const result = transliterate('ka', 'telugu')
    expect(result).toContain('క')
    expect(result).toContain('అ')
  })

  it('handles Kannada: "ma"', () => {
    const result = transliterate('ma', 'kannada')
    expect(result).toContain('ಮ')
    expect(result).toContain('ಅ')
  })

  it('handles Malayalam: "na"', () => {
    const result = transliterate('na', 'malayalam')
    expect(result).toContain('ന')
    expect(result).toContain('അ')
  })

  it('handles Bengali: "ba"', () => {
    const result = transliterate('ba', 'bengali')
    expect(result).toContain('ব')
    expect(result).toContain('অ')
  })

  it('handles Gujarati: "ga"', () => {
    const result = transliterate('ga', 'gujarati')
    expect(result).toContain('ગ')
    expect(result).toContain('અ')
  })

  it('handles Gurmukhi: "sa"', () => {
    const result = transliterate('sa', 'gurmukhi')
    expect(result).toContain('ਸ')
    expect(result).toContain('ਅ')
  })

  it('handles Odia: "ra"', () => {
    const result = transliterate('ra', 'odia')
    expect(result).toContain('ର')
    expect(result).toContain('ଅ')
  })

  it('passes through unrecognized characters', () => {
    const result = transliterate('hello!', 'devanagari')
    expect(result).toContain('!')
  })

  it('prefers longest match: "kh" before "k"', () => {
    const result = transliterate('kha', 'devanagari')
    expect(result).toContain('ख') // kh → ख, not क + ह
    expect(result).not.toContain('क')
  })
})
