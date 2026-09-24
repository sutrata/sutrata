import { describe, it, expect } from 'vitest'
import { parse } from '@sutrata/parser'
import { sutraToProsemirror } from '../../src/editor/sutra-to-prosemirror'
import { prosemirrorToSutra } from '../../src/editor/prosemirror-to-sutra'
import { schema } from '../../src/editor/schema'

describe('inline [[ ]] note — Sutra <-> ProseMirror bridge', () => {
  it('carries the note_mark on the bracketed text when converting Sutra to ProseMirror', () => {
    const src = "## SC1\n\nThere's no next train. [[दर्शक को यहीं पता चलना चाहिए]]\n"
    const ast = parse(src)
    const pmDoc = sutraToProsemirror(ast)

    let found: { text: string | null; hasMark: boolean } | null = null
    pmDoc.descendants(node => {
      if (node.isText && node.text?.includes('दर्शक')) {
        found = { text: node.text, hasMark: !!node.marks.find(m => m.type === schema.marks['note_mark']) }
      }
    })

    expect(found).not.toBeNull()
    expect(found!.hasMark).toBe(true)
  })

  it('round-trips the note back into [[ ]] brackets when converting ProseMirror to Sutra', () => {
    const src = "## SC1\n\nThere's no next train. [[दर्शक को यहीं पता चलना चाहिए]]\n"
    const ast = parse(src)
    const pmDoc = sutraToProsemirror(ast)
    const out = prosemirrorToSutra(pmDoc)

    expect(out).toContain('[[दर्शक को यहीं पता चलना चाहिए]]')
  })
})
