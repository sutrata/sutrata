import { describe, it, expect } from 'vitest'
import { getTemplate, TEMPLATES } from '../../src/templates/templates'

describe('templates', () => {
  it('getTemplate returns a string for English', () => {
    const t = getTemplate('en')
    expect(typeof t).toBe('string')
    expect(t.length).toBeGreaterThan(0)
  })

  it('English template contains required Sutra elements', () => {
    const t = getTemplate('en')
    expect(t).toContain('---')          // frontmatter
    expect(t).toContain('lang: en')     // language declaration
    expect(t).toContain('## ')          // scene heading
    expect(t).toContain('@')            // character cue
  })

  it('returns Hindi template with Devanagari content', () => {
    const t = getTemplate('hi')
    expect(t).toContain('lang: hi')
    // Should contain Devanagari characters
    expect(/[ऀ-ॿ]/.test(t)).toBe(true)
  })

  it('returns Tamil template with Tamil content', () => {
    const t = getTemplate('ta')
    expect(t).toContain('lang: ta')
    expect(/[஀-௿]/.test(t)).toBe(true)
  })

  it('returns Telugu template with Telugu content', () => {
    const t = getTemplate('te')
    expect(t).toContain('lang: te')
    expect(/[ఀ-౿]/.test(t)).toBe(true)
  })

  it('returns Kannada template with Kannada content', () => {
    const t = getTemplate('kn')
    expect(t).toContain('lang: kn')
    expect(/[ಀ-೿]/.test(t)).toBe(true)
  })

  it('returns Malayalam template with Malayalam content', () => {
    const t = getTemplate('ml')
    expect(t).toContain('lang: ml')
    expect(/[ഀ-ൿ]/.test(t)).toBe(true)
  })

  it('returns Bengali template with Bengali content', () => {
    const t = getTemplate('bn')
    expect(t).toContain('lang: bn')
    expect(/[ঀ-৿]/.test(t)).toBe(true)
  })

  it('returns Gujarati template with Gujarati content', () => {
    const t = getTemplate('gu')
    expect(t).toContain('lang: gu')
    expect(/[઀-૿]/.test(t)).toBe(true)
  })

  it('falls back to English for unknown language code', () => {
    const t = getTemplate('xx')
    expect(t).toContain('lang: en')
  })

  it('all template languages are covered', () => {
    const langs = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'bn', 'gu', 'mr', 'pa', 'or', 'si']
    for (const lang of langs) {
      expect(TEMPLATES[lang]).toBeDefined()
      expect(TEMPLATES[lang].length).toBeGreaterThan(50)
    }
  })

  it('every template contains frontmatter, scene heading, character cue', () => {
    for (const [lang, tmpl] of Object.entries(TEMPLATES)) {
      expect(tmpl, `${lang}: missing frontmatter`).toContain('---')
      expect(tmpl, `${lang}: missing scene heading`).toContain('## ')
      expect(tmpl, `${lang}: missing character cue`).toContain('@')
      expect(tmpl.length, `${lang}: template too short`).toBeGreaterThan(50)
    }
  })
})
