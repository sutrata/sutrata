import { describe, it, expect } from 'vitest'
import { languageByCode, languageForWord } from '../../src/spellcheck/languages'
import { isShouted, normalizeWord, tokenizeWords } from '../../src/spellcheck/tokenize'

describe('languageForWord', () => {
  const tamil = languageByCode('ta')

  it('sends Latin words to English and Tamil words to Tamil', () => {
    expect(languageForWord('hello', tamil)).toBe('en')
    expect(languageForWord('வணக்கம்', tamil)).toBe('ta')
  })

  it('does not check a script that is not selected', () => {
    expect(languageForWord('வணக்கம்', undefined)).toBeNull()
    expect(languageForWord('नमस्ते', tamil)).toBeNull()
  })

  it('does not check words that mix Latin and regional letters', () => {
    expect(languageForWord('வணக்கமhi', tamil)).toBeNull()
  })
})

describe('tokenizeWords', () => {
  it('keeps Indic combining marks and joiners inside the word', () => {
    expect(tokenizeWords('வணக்கம் உலகம்').map(t => t.word)).toEqual(['வணக்கம்', 'உலகம்'])
    expect(tokenizeWords('क्‍ष').map(t => t.word)).toEqual(['क्‍ष'])
  })

  it('keeps apostrophes and hyphens between letters', () => {
    expect(tokenizeWords("don’t well-known 'quoted'").map(t => t.word)).toEqual(['don’t', 'well-known', 'quoted'])
  })

  it('normalizes typographic apostrophes and spots shouted words', () => {
    expect(normalizeWord('don’t')).toBe("don't")
    expect(isShouted('NYPD')).toBe(true)
    expect(isShouted('Hello')).toBe(false)
    expect(isShouted('வ')).toBe(false)
  })
})
