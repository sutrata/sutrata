import { describe, it, expect } from 'vitest'
import { tokenize } from '../src/lexer.js'
import { parse } from '../src/parser.js'

describe('tokenize', () => {
  it('identifies a scene heading', () => {
    const tokens = tokenize('## INT. OFFICE - DAY {#sc1}\n')
    expect(tokens[0]?.type).toBe('scene-heading')
    expect(tokens[0]?.text).toBe('INT. OFFICE - DAY')
    expect(tokens[0]?.id).toBe('sc1')
  })

  it('identifies action (plain paragraph)', () => {
    const tokens = tokenize('The office is empty.\n')
    expect(tokens[0]?.type).toBe('action')
  })

  it('identifies character cue', () => {
    const tokens = tokenize('@JOHN (V.O.)\n')
    expect(tokens[0]?.type).toBe('character')
    expect(tokens[0]?.text).toBe('JOHN')
    expect(tokens[0]?.extension).toBe('(V.O.)')
  })

  it('identifies dual dialogue marker', () => {
    const tokens = tokenize('@MARY ^\n')
    expect(tokens[0]?.type).toBe('character')
    expect(tokens[0]?.isDual).toBe(true)
  })

  it('identifies scene metadata', () => {
    const tokens = tokenize('& actors: Alice, Bob\n')
    expect(tokens[0]?.type).toBe('scene-metadata')
    expect(tokens[0]?.key).toBe('actors')
    expect(tokens[0]?.value).toBe('Alice, Bob')
  })

  it('identifies transition', () => {
    const tokens = tokenize('>> CUT TO:\n')
    expect(tokens[0]?.type).toBe('transition')
    expect(tokens[0]?.text).toBe('CUT TO:')
  })

  it('identifies centered text', () => {
    const tokens = tokenize('>> INTERMISSION <<\n')
    expect(tokens[0]?.type).toBe('centered')
    expect(tokens[0]?.text).toBe('INTERMISSION')
  })

  it('identifies lyrics', () => {
    const tokens = tokenize('~ Chall chhaiyaan chhaiyaan\n')
    expect(tokens[0]?.type).toBe('lyrics')
  })

  it('identifies note', () => {
    const tokens = tokenize('[[ Add rain here ]]\n')
    expect(tokens[0]?.type).toBe('note')
    expect(tokens[0]?.text).toBe('Add rain here')
  })

  it('identifies comment', () => {
    const tokens = tokenize('<!-- old scene -->\n')
    expect(tokens[0]?.type).toBe('comment')
  })

  it('identifies page break', () => {
    const tokens = tokenize('===\n')
    expect(tokens[0]?.type).toBe('page-break')
  })

  it('identifies section heading', () => {
    const tokens = tokenize('# ACT ONE {#act1}\n')
    expect(tokens[0]?.type).toBe('section')
    expect(tokens[0]?.level).toBe(1)
    expect(tokens[0]?.id).toBe('act1')
  })

  it('identifies parenthetical inside dialogue context', () => {
    const tokens = tokenize('( whispering )\n')
    expect(tokens[0]?.type).toBe('parenthetical')
    expect(tokens[0]?.text).toBe('whispering')
  })

  it('centered is detected before transition', () => {
    // ">>" + text + "<<" must match centered, not transition
    const tokens = tokenize('>> END <<\n')
    expect(tokens[0]?.type).toBe('centered')
  })

  it('identifies blank line', () => {
    const tokens = tokenize('\n')
    expect(tokens[0]?.type).toBe('blank')
  })

  it('scene heading without id has null id', () => {
    const tokens = tokenize('## INT. OFFICE - DAY\n')
    expect(tokens[0]?.type).toBe('scene-heading')
    expect(tokens[0]?.id).toBeNull()
  })

  it('bare dialogue line falls through to action', () => {
    const tokens = tokenize('He never loved her.\n')
    expect(tokens[0]?.type).toBe('action')
  })
})

describe('parse', () => {
  it('parses a minimal document', () => {
    const src = '## INT. OFFICE - DAY\n\nThe office is empty.\n'
    const doc = parse(src)
    expect(doc.type).toBe('document')
    expect(doc.children).toHaveLength(1)
    expect(doc.children[0]!.type).toBe('scene-heading')
  })

  it('nests action inside scene heading', () => {
    const src = '## INT. OFFICE - DAY\n\nThe office is empty.\n'
    const doc = parse(src)
    const scene = doc.children[0] as import('../src/types.js').SceneHeadingNode
    expect(scene.children[0]!.type).toBe('action')
  })

  it('nests dialogue under character', () => {
    const src = '## INT. OFFICE - DAY\n\n@JOHN\nHello.\n'
    const doc = parse(src)
    const scene = doc.children[0] as import('../src/types.js').SceneHeadingNode
    const char = scene.children[0] as import('../src/types.js').CharacterNode
    expect(char.type).toBe('character')
    expect(char.children[0]!.type).toBe('dialogue')
  })

  it('attaches synopsis (via & synopsis:) and metadata to scene heading', () => {
    const src = '## INT. OFFICE - DAY\n& synopsis: John arrives.\n& actors: John\n\nAction.\n'
    const doc = parse(src)
    const scene = doc.children[0] as import('../src/types.js').SceneHeadingNode
    expect(scene.metadata[0]?.key).toBe('synopsis')
    expect(scene.metadata[0]?.value).toBe('John arrives.')
    expect(scene.metadata[1]?.key).toBe('actors')
  })

  it('parses dual dialogue into DualDialogueNode', () => {
    const src = '## SC1\n\n@JOHN\nHello.\n\n@MARY ^\nHi.\n'
    const doc = parse(src)
    const scene = doc.children[0] as import('../src/types.js').SceneHeadingNode
    const dd = scene.children.find(n => n.type === 'dual-dialogue')
    expect(dd).toBeDefined()
  })

  it('preserves unknown metadata keys', () => {
    const src = '## SC1\n& custom-prop: value\n\nAction.\n'
    const doc = parse(src)
    const scene = doc.children[0] as import('../src/types.js').SceneHeadingNode
    expect(scene.metadata[0]?.key).toBe('custom-prop')
    expect(scene.metadata[0]?.value).toBe('value')
  })
})
