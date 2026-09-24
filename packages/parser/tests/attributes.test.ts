import { describe, it, expect } from 'vitest'
import { splitAttributeBlock, formatAttributeBlock } from '../src/attributes.js'
import { tokenize } from '../src/lexer.js'
import { parse } from '../src/parser.js'
import { serialize } from '../src/serializer.js'

describe('splitAttributeBlock', () => {
  it('splits id and key=value entries in order', () => {
    expect(splitAttributeBlock('INT. HOUSE {#sc12 lang=en x-cam="A cam"}')).toEqual({
      body: 'INT. HOUSE',
      id: 'sc12',
      attrs: [{ key: 'lang', value: 'en' }, { key: 'x-cam', value: 'A cam' }],
    })
  })

  it('keeps classes and a second #id as valueless attributes', () => {
    expect(splitAttributeBlock('X {.flashback #a #b}')).toEqual({
      body: 'X', id: 'a', attrs: [{ key: '.flashback', value: null }, { key: '#b', value: null }],
    })
  })

  it('accepts a block without an id', () => {
    expect(splitAttributeBlock('रेलवे स्टेशन {lang=hi}')).toEqual({
      body: 'रेलवे स्टेशन', id: null, attrs: [{ key: 'lang', value: 'hi' }],
    })
  })

  it('leaves {…} text that is not an attribute block alone', () => {
    expect(splitAttributeBlock('EXT. PARK {DAY 2}')).toEqual({ body: 'EXT. PARK {DAY 2}', id: null, attrs: [] })
    expect(splitAttributeBlock('EXT. PARK{#x}')).toEqual({ body: 'EXT. PARK{#x}', id: null, attrs: [] })
    expect(splitAttributeBlock('EXT. PARK {}')).toEqual({ body: 'EXT. PARK {}', id: null, attrs: [] })
  })

  it('formats back to an equivalent block', () => {
    const attrs = [{ key: 'lang', value: 'en' }, { key: 'note', value: 'two words' }, { key: 'empty', value: '' }, { key: '.c', value: null }]
    const text = `H${formatAttributeBlock('12A', attrs)}`
    expect(text).toBe('H {#12A lang=en note="two words" empty="" .c}')
    expect(splitAttributeBlock(text)).toEqual({ body: 'H', id: '12A', attrs })
    expect(formatAttributeBlock(null, [])).toBe('')
  })

  it('round-trips quotes and backslashes inside quoted values', () => {
    const attrs = [{ key: 'q', value: 'say "hi" \\ bye' }]
    expect(splitAttributeBlock(`H${formatAttributeBlock(null, attrs)}`).attrs).toEqual(attrs)
  })
})

describe('attributes on elements', () => {
  it('scene heading: id and unknown attributes are split from the text', () => {
    const t = tokenize('## INT. रेलवे स्टेशन - रात {#sc12 lang=hi x-unit=2}')[0]!
    expect(t.text).toBe('INT. रेलवे स्टेशन - रात')
    expect(t.id).toBe('sc12')
    expect(t.attrs).toEqual([{ key: 'lang', value: 'hi' }, { key: 'x-unit', value: '2' }])
  })

  it('scene heading: an attribute block without # is no longer heading text', () => {
    const doc = parse('## INT. HOUSE {lang=en}\n')
    const h = doc.children[0]
    expect(h?.type === 'scene-heading' && [h.text, h.id, h.attrs]).toEqual(['INT. HOUSE', null, [{ key: 'lang', value: 'en' }]])
  })

  it('section heading carries attributes', () => {
    const doc = parse('# कथा-सार {#synopsis lang=hi}\n')
    const s = doc.children[0]
    expect(s?.type === 'section' && [s.text, s.id, s.attrs]).toEqual(['कथा-सार', 'synopsis', [{ key: 'lang', value: 'hi' }]])
  })

  it('character cue carries attributes after the extension and dual marker', () => {
    const t = tokenize('@VIKRAM (V.O.) ^ {lang=en}')[0]!
    expect([t.text, t.extension, t.isDual, t.id, t.attrs]).toEqual(['VIKRAM', '(V.O.)', true, null, [{ key: 'lang', value: 'en' }]])
  })

  it('byte-faithful round-trip is unaffected', () => {
    const src = '## INT. HOUSE {#1 lang=en}\n\n@A {lang=hi}\nहाँ।\n'
    expect(serialize(parse(src))).toBe(src)
  })
})

describe('scene metadata lists and placement', () => {
  it('collects indented - items under a key with an empty value (§7.1)', () => {
    const src = '## INT. X\n& shots:\n  - WIDE: platform\n  - CU: मीरा\n& status: draft\n\nAction.\n'
    const h = parse(src).children[0]
    if (h?.type !== 'scene-heading') throw new Error('expected heading')
    expect(h.metadata.map(m => [m.key, m.value, m.items])).toEqual([
      ['shots', '', ['WIDE: platform', 'CU: मीरा']],
      ['status', 'draft', undefined],
    ])
    expect(h.children.map(c => c.type)).toEqual(['action'])
    expect(serialize(parse(src))).toBe(src)
  })

  it('metadata separated from the heading by blank lines is still metadata', () => {
    const src = '## INT. X\n\n& synopsis: one\n\n& status: draft\n\nAction.\n'
    const h = parse(src).children[0]
    if (h?.type !== 'scene-heading') throw new Error('expected heading')
    expect(h.metadata.map(m => m.key)).toEqual(['synopsis', 'status'])
    expect(h.children.map(c => c.type)).toEqual(['action'])
    expect(serialize(parse(src))).toBe(src)
  })

  it('does not duplicate body lines that share the heading block', () => {
    const src = '## H\n& k: v\nSome action\n\n@A\nhi\n'
    const out = serialize(parse(src))
    expect(out.match(/Some action/g)).toHaveLength(1)
    expect(parse(out)).toEqual(parse(src.replace('v\nSome', 'v\n\nSome')))
  })

  it('character registry metadata supports lists', () => {
    const doc = parse('# पात्र {#characters}\n\n@मीरा\n& aliases:\n  - डॉ. मीरा\n& actor: दीपिका\n')
    const c = doc.children[1]
    if (c?.type !== 'character') throw new Error('expected character')
    expect(c.metadata?.map(m => [m.key, m.value, m.items])).toEqual([
      ['aliases', '', ['डॉ. मीरा']], ['actor', 'दीपिका', undefined],
    ])
    expect(c.children).toEqual([])
  })
})

describe('multi-line blocks', () => {
  it('keeps every line of a lyrics block', () => {
    const l = parse('~ चल छैयाँ\n~ **छैयाँ**\n').children[0]
    expect(l?.type === 'lyrics' && l.spans).toEqual([
      { type: 'text', text: 'चल छैयाँ' }, { type: 'text', text: '\n' },
      { type: 'bold', spans: [{ type: 'text', text: 'छैयाँ' }] },
    ])
  })

  it('keeps every line of centered and transition blocks', () => {
    const [c, t] = parse('>> THE END <<\n>> समाप्त <<\n\n>> CUT TO:\nLATER\n').children
    expect(c?.type === 'centered' && c.text).toBe('THE END\nसमाप्त')
    expect(t?.type === 'transition' && t.text).toBe('CUT TO:\nLATER')
  })

  it('a [[note]] line followed by more text is action, not a standalone note', () => {
    const n = parse('[[ check ]]\nThe door opens.\n').children[0]
    expect(n?.type).toBe('action')
  })
})

describe('emphasis', () => {
  it('***x*** is bold italic', () => {
    const a = parse('A ***big*** deal\n').children[0]
    expect(a?.type === 'action' && a.spans).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'bold', spans: [{ type: 'italic', spans: [{ type: 'text', text: 'big' }] }] },
      { type: 'text', text: ' deal' },
    ])
  })
})
