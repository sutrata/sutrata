import { parse } from '@sutrata/parser'
import { readTitlePage, writeTitlePage, splitList } from '../../src/titlepage/frontmatter-form'

const SRC = `---
format: sutra/1.0
title:
  hi: आख़िरी ट्रेन
  en: The Last Train
author: रंगी पराता
date: June 2026
contact: |
  rangi@example.com
  +91 98xxx xxxxx
lang: hi
lang-secondary: [en]
producer: Big Films
characters:
  JOHN: Actor One
---

## INT. STATION - NIGHT
`

const read = (text: string) => readTitlePage(parse(text).frontmatter?.data as Record<string, unknown>)

describe('readTitlePage', () => {
  it('reads the multilingual title with the primary language first', () => {
    const f = read(SRC)
    expect(f.title).toBe('आख़िरी ट्रेन')
    expect(f.altTitles).toEqual([{ lang: 'en', text: 'The Last Train' }])
    expect(f.lang).toBe('hi')
    expect(f.langSecondary).toEqual(['en'])
    expect(f.contact).toBe('rangi@example.com\n+91 98xxx xxxxx')
  })

  it('lists simple unknown keys as custom rows, hides format and nested maps', () => {
    const f = read(SRC)
    expect(f.custom).toEqual([{ key: 'producer', value: 'Big Films' }])
  })

  it('splits list values in every shape', () => {
    expect(splitList('[en, sa]')).toEqual(['en', 'sa'])
    expect(splitList('en')).toEqual(['en'])
    expect(splitList(['ta'])).toEqual(['ta'])
  })
})

describe('writeTitlePage', () => {
  it('leaves the text byte-identical when nothing changed', () => {
    const f = read(SRC)
    expect(writeTitlePage(SRC, f, { ...f })).toBe(SRC)
  })

  it('rewrites only the changed key and keeps everything else in place', () => {
    const f = read(SRC)
    const out = writeTitlePage(SRC, f, { ...f, author: 'Meera Nair' })
    expect(out).toBe(SRC.replace('author: रंगी पराता', 'author: Meera Nair'))
  })

  it('appends new keys in canonical order before the closing fence', () => {
    const f = read(SRC)
    const out = writeTitlePage(SRC, f, { ...f, style: 'traditional', page: 'A4', draft: 'Second Draft' })
    const fm = out.split('---')[1]!
    expect(fm.trimEnd().split('\n').slice(-3)).toEqual(['draft: Second Draft', 'page: A4', 'style: traditional'])
    expect(parse(out).frontmatter!.data['style']).toBe('traditional')
  })

  it('removes keys that were cleared', () => {
    const f = read(SRC)
    const out = writeTitlePage(SRC, f, { ...f, contact: '' })
    expect(out).not.toContain('contact')
    expect(out).not.toContain('rangi@example.com')
    expect(out).toContain('author: रंगी पराता')
  })

  it('writes the multilingual title as a nested map and a plain title as a scalar', () => {
    const f = read(SRC)
    const both = writeTitlePage(SRC, f, { ...f, altTitles: [...f.altTitles, { lang: 'ta', text: 'கடைசி ரயில்' }] })
    expect(parse(both).frontmatter!.data['title']).toEqual({ hi: 'आख़िरी ट्रेन', en: 'The Last Train', ta: 'கடைசி ரயில்' })
    const single = writeTitlePage(SRC, f, { ...f, altTitles: [] })
    expect(parse(single).frontmatter!.data['title']).toBe('आख़िरी ट्रेन')
  })

  it('writes secondary languages as a flow list and multi-line contact as a block', () => {
    const f = read(SRC)
    const out = writeTitlePage(SRC, f, { ...f, langSecondary: ['en', 'sa'], contact: 'a@b.c\nPhone' })
    expect(out).toContain('lang-secondary: [en, sa]')
    expect(out).toContain('contact: |\n  a@b.c\n  Phone')
    expect(parse(out).frontmatter!.data['contact']).toBe('a@b.c\nPhone')
  })

  it('edits, removes and adds custom fields, never touching nested unknown maps', () => {
    const f = read(SRC)
    const out = writeTitlePage(SRC, f, { ...f, custom: [{ key: 'studio', value: 'Lotus' }] })
    expect(out).not.toContain('producer:')
    expect(out).toContain('studio: Lotus')
    expect(out).toContain('characters:\n  JOHN: Actor One')
    expect(out).toContain('format: sutra/1.0')
  })

  it('creates a frontmatter block when the document has none', () => {
    const body = '## INT. ROOM - DAY\n'
    const f = read(body)
    const out = writeTitlePage(body, f, { ...f, title: 'New Film', date: '2026-09-19' })
    expect(out).toBe('---\ntitle: New Film\ndate: 2026-09-19\n---\n\n## INT. ROOM - DAY\n')
  })

  it('preserves CRLF line endings', () => {
    const crlf = SRC.replace(/\n/g, '\r\n')
    const f = read(crlf)
    const out = writeTitlePage(crlf, f, { ...f, author: 'X' })
    expect(out).toContain('author: X\r\n')
    expect(out.replace(/\r\n/g, '')).not.toContain('\n')
  })
})
