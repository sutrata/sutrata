import { EditorState, TextSelection } from 'prosemirror-state'
import { parse } from '@sutrata/parser'
import { schema } from '../../src/editor/schema'
import { sutraToProsemirror } from '../../src/editor/sutra-to-prosemirror'
import { prosemirrorToSutra } from '../../src/editor/prosemirror-to-sutra'
import { afterHeadingMetadata, insertActionAfterHeading } from '../../src/editor/scene-heading-exit'

const stateOf = (text: string) => EditorState.create({ doc: sutraToProsemirror(parse(text)), schema })

describe('insertActionAfterHeading', () => {
  it('puts the new line after the heading\'s metadata, so the metadata stays attached', () => {
    const state = stateOf('## INT. A {#1}\n& synopsis: s\n& x-sc-scene-id: abc\n\nHello.\n')
    const after = state.apply(insertActionAfterHeading(state, 0))
    const kinds: string[] = []
    after.doc.forEach(n => kinds.push(n.type.name))
    expect(kinds).toEqual(['scene_heading', 'scene_metadata', 'scene_metadata', 'action', 'action'])
    expect(after.selection.$from.parent.type.name).toBe('action')
    expect(after.selection.$from.parent.content.size).toBe(0)
    // Typing into it must not detach the reference line from the heading.
    const typed = after.apply(after.tr.insertText('Rain.'))
    const text = prosemirrorToSutra(typed.doc)
    expect(text.indexOf('x-sc-scene-id')).toBeLessThan(text.indexOf('Rain.'))
  })

  it('at the end of the document, creates the empty line to type in', () => {
    const state = stateOf('## INT. A {#1}\n& x-sc-scene-id: abc\n')
    expect(afterHeadingMetadata(state, 0)).toBe(state.doc.content.size)
    const after = state.apply(insertActionAfterHeading(state, 0))
    expect(after.selection).toBeInstanceOf(TextSelection)
    expect(after.selection.$from.parent.type.name).toBe('action')
  })
})
