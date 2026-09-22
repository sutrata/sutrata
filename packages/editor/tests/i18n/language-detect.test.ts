import { describe, it, expect } from 'vitest'
import { detectScript } from '../../src/i18n/language-detect'

describe('language-detect', () => {
  it('detects pure Devanagari text as Hindi', () => {
    const result = detectScript('यह एक नमूना पंक्ति है।')
    expect(result).toBe('hi')
  })

  it('detects pure Tamil text as Tamil', () => {
    const result = detectScript('இது ஒரு மாதிரி வரி.')
    expect(result).toBe('ta')
  })

  it('detects pure Telugu text as Telugu', () => {
    const result = detectScript('ఇది ఒక నమూనా లైన్.')
    expect(result).toBe('te')
  })

  it('detects mixed Devanagari + Latin as dominant Devanagari (Hindi)', () => {
    const result = detectScript('यह एक नमूना hello')
    expect(result).toBe('hi')
  })

  it('detects mixed Tamil + Latin as dominant Tamil', () => {
    const result = detectScript('இது hello வரி')
    expect(result).toBe('ta')
  })

  it('detects pure Latin / English as English', () => {
    const result = detectScript('This is a sample line.')
    expect(result).toBe('en')
  })

  it('returns English for empty string', () => {
    const result = detectScript('')
    expect(result).toBe('en')
  })

  it('detects Bengali text', () => {
    const result = detectScript('এটি একটি নমুনা লাইন।')
    expect(result).toBe('bn')
  })

  it('detects Gujarati text', () => {
    const result = detectScript('આ એક નમૂનો લાઇન છે.')
    expect(result).toBe('gu')
  })

  it('detects Malayalam text', () => {
    const result = detectScript('ഇത് ഒരു സാമ്പിൾ ലൈൻ ആണ്.')
    expect(result).toBe('ml')
  })
})
