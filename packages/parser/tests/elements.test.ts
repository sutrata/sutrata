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

  it('captures multiple trailing paren groups as one extension string', () => {
    const tokens = tokenize("@JOHN (V.O.) (CONT'D)\n")
    expect(tokens[0]?.type).toBe('character')
    expect(tokens[0]?.text).toBe('JOHN')
    expect(tokens[0]?.extension).toBe("(V.O.) (CONT'D)")
  })

  it('captures multiple trailing paren groups together with the dual-dialogue marker', () => {
    const tokens = tokenize("@JOHN (V.O.) (CONT'D) ^\n")
    expect(tokens[0]?.type).toBe('character')
    expect(tokens[0]?.extension).toBe("(V.O.) (CONT'D)")
    expect(tokens[0]?.isDual).toBe(true)
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

  it('identifies parenthetical with fullwidth CJK-style parentheses', () => {
    const tokens = tokenize('（ धीरे से ）\n')
    expect(tokens[0]?.type).toBe('parenthetical')
    expect(tokens[0]?.text).toBe('धीरे से')
  })

  it('identifies parenthetical with mixed ASCII/fullwidth parentheses', () => {
    const tokens = tokenize('(softly）\n')
    expect(tokens[0]?.type).toBe('parenthetical')
    expect(tokens[0]?.text).toBe('softly')
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

  it('parses an inline [[ ]] note mid-line into a distinct note span', () => {
    const src = "## SC1\n\nThere's no next train. [[दर्शक को यहीं पता चलना चाहिए]]\n"
    const doc = parse(src)
    const scene = doc.children[0] as import('../src/types.js').SceneHeadingNode
    const action = scene.children[0] as import('../src/types.js').ActionNode
    expect(action.type).toBe('action')
    expect(action.spans).toEqual([
      { type: 'text', text: "There's no next train. " },
      { type: 'note', text: 'दर्शक को यहीं पता चलना चाहिए' },
    ])
  })

  it('a whole-line [[ ]] still parses as a block-level NoteNode, not an inline span', () => {
    const src = '## SC1\n\n[[ Add establishing shot ]]\n'
    const doc = parse(src)
    const scene = doc.children[0] as import('../src/types.js').SceneHeadingNode
    expect(scene.children[0]!.type).toBe('note')
  })

  it('parses a multi-line comment (no embedded blank line) as one CommentNode', () => {
    const src = '## SC1\n\n<!--\nold version\nof the scene\n-->\n\nAction.\n'
    const doc = parse(src)
    const scene = doc.children[0] as import('../src/types.js').SceneHeadingNode
    expect(scene.children[0]!.type).toBe('comment')
    expect((scene.children[0] as import('../src/types.js').CommentNode).text).toBe('old version\nof the scene')
    expect(scene.children[1]!.type).toBe('action')
  })

  it('parses a multi-line comment that itself contains a blank line as one CommentNode', () => {
    const src = '## SC1\n\n<!--\nParagraph one.\n\nParagraph two.\n-->\n\nAction.\n'
    const doc = parse(src)
    const scene = doc.children[0] as import('../src/types.js').SceneHeadingNode
    expect(scene.children[0]!.type).toBe('comment')
    expect((scene.children[0] as import('../src/types.js').CommentNode).text).toBe('Paragraph one.\n\nParagraph two.')
    expect(scene.children[1]!.type).toBe('action')
  })

  it('still treats a single-line comment as a CommentNode (unchanged behavior)', () => {
    const src = '## SC1\n\n<!-- old scene -->\n\nAction.\n'
    const doc = parse(src)
    const scene = doc.children[0] as import('../src/types.js').SceneHeadingNode
    expect(scene.children[0]!.type).toBe('comment')
  })

  it('parses & lines after a @cue inside a {#characters} registry as metadata, not dialogue', () => {
    const src = '# पात्र {#characters}\n\n@विक्रम\n& actor: रणबीर\n& aliases: वी\n'
    const doc = parse(src)
    const char = doc.children.find(n => n.type === 'character') as import('../src/types.js').CharacterNode
    expect(char).toBeDefined()
    expect(char.children).toHaveLength(0)
    expect(char.metadata).toEqual([
      { type: 'scene-metadata', raw: '& actor: रणबीर', key: 'actor', value: 'रणबीर' },
      { type: 'scene-metadata', raw: '& aliases: वी', key: 'aliases', value: 'वी' },
    ])
  })

  it('recognizes a bare "# Characters" heading (no {#id}) as the registry section too', () => {
    const src = '# Characters\n\n@VIKRAM\n& actor: Ranbir\n'
    const doc = parse(src)
    const char = doc.children.find(n => n.type === 'character') as import('../src/types.js').CharacterNode
    expect(char.metadata?.[0]).toEqual({ type: 'scene-metadata', raw: '& actor: Ranbir', key: 'actor', value: 'Ranbir' })
  })

  it('clears registry context at the next section, so a later @cue is not treated as a registry entry', () => {
    const src = '# Characters {#characters}\n\n@VIKRAM\n& actor: Ranbir\n\n# ACT ONE {#act1}\n\n## INT. HOUSE - DAY\n\n@VIKRAM\nHello.\n'
    const doc = parse(src)
    const scene = doc.children.find(n => n.type === 'scene-heading') as import('../src/types.js').SceneHeadingNode
    const inSceneChar = scene.children[0] as import('../src/types.js').CharacterNode
    expect(inSceneChar.type).toBe('character')
    expect(inSceneChar.children[0]!.type).toBe('dialogue')
    expect(inSceneChar.metadata).toBeUndefined()
  })

  it('does not treat a & line inside a normal in-scene dialogue block as registry metadata', () => {
    // & lines can't normally follow a @cue mid-scene (scene metadata only
    // follows a scene heading directly), but guard the registry check isn't
    // over-broad if one appears there anyway.
    const src = '## INT. HOUSE - DAY\n\n@JOHN\n& not-really-metadata: value\n'
    const doc = parse(src)
    const scene = doc.children[0] as import('../src/types.js').SceneHeadingNode
    const char = scene.children[0] as import('../src/types.js').CharacterNode
    expect(char.metadata).toBeUndefined()
    expect(char.children[0]!.type).toBe('dialogue')
  })
})
