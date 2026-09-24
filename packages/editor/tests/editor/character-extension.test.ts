import { describe, it, expect } from 'vitest'
import { parse } from '@sutrata/parser'
import { sutraToProsemirror } from '../../src/editor/sutra-to-prosemirror'
import { prosemirrorToSutra } from '../../src/editor/prosemirror-to-sutra'

function characterText(src: string): string {
  const pmDoc = sutraToProsemirror(parse(src))
  let text = ''
  pmDoc.descendants(node => {
    if (node.type.name === 'character') text = node.textContent
  })
  return text
}

describe('character extension/dual-marker — Sutra <-> ProseMirror bridge (text-based, no attrs)', () => {
  it('puts the extension directly in the character node text, no separate attr', () => {
    expect(characterText('## SC1\n\n@ARAVIND (V.O.)\nHello.\n')).toBe('ARAVIND (V.O.)')
  })

  it('handles multiple trailing paren groups', () => {
    expect(characterText("## SC1\n\n@ARAVIND (V.O.) (CONT'D)\nHello.\n")).toBe("ARAVIND (V.O.) (CONT'D)")
  })

  it('handles a plain name with no extension', () => {
    expect(characterText('## SC1\n\n@ARAVIND\nHello.\n')).toBe('ARAVIND')
  })

  it.each([
    '@ARAVIND (V.O.)',
    "@ARAVIND (V.O.) (CONT'D)",
    '@ARAVIND',
  ])('round-trips %s back to the exact source line', (cue) => {
    const src = `## SC1\n\n${cue}\nHello.\n`
    const out = prosemirrorToSutra(sutraToProsemirror(parse(src)))
    expect(out).toContain(cue)
  })

  it('round-trips a dual-dialogue pair including the ^ marker and an extension', () => {
    const src = "## SC1\n\n@ARAVIND (V.O.)\nHello.\n\n@MEERA ^\nHi.\n"
    const out = prosemirrorToSutra(sutraToProsemirror(parse(src)))
    expect(out).toContain('@ARAVIND (V.O.)')
    expect(out).toContain('@MEERA ^')
  })
})
