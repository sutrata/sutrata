import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { parse } from '@sutrata/parser'
import { sutraToProsemirror } from '../../src/editor/sutra-to-prosemirror'
import { prosemirrorToSutra } from '../../src/editor/prosemirror-to-sutra'
import { buildPlugins } from '../../src/editor/plugins'

const TEXT = '## INT. A {#1}\n& x-sc-scene-id: REF\n\nAction.\n'

function setup() {
  const doc = sutraToProsemirror(parse(TEXT))
  const view = new EditorView(document.createElement('div'), { state: EditorState.create({ doc, plugins: buildPlugins() }) })
  const blocks: { name: string; pos: number; size: number }[] = []
  doc.forEach((n, pos) => blocks.push({ name: n.type.name, pos, size: n.nodeSize }))
  return { view, blocks }
}

function key(view: EditorView, k: string) {
  const event = new KeyboardEvent('keydown', { key: k })
  return view.someProp('handleKeyDown', f => f(view, event))
}

describe('tool-private x- metadata in the editor (format spec §7.1)', () => {
  it('is rendered hidden', () => {
    const { view } = setup()
    expect(view.dom.querySelector('.cs-scene-metadata[data-private="true"]')?.textContent).toBe('REF')
  })

  it('keeps the caret out of the hidden block, in the direction it was moving', () => {
    const { view, blocks } = setup()
    const [heading, meta, action] = blocks
    expect(meta!.name).toBe('scene_metadata')
    // moving up from the action lands on the heading's end
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, action!.pos + 1)))
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, meta!.pos + 2)))
    expect(view.state.selection.head).toBe(heading!.pos + heading!.size - 1)
    // moving down from the heading lands on the action's start
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, meta!.pos + 2)))
    expect(view.state.selection.head).toBe(action!.pos + 1)
  })

  it('Backspace at the start of the action and Delete at the end of the heading step over it', () => {
    const { view, blocks } = setup()
    const [heading, , action] = blocks
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, action!.pos + 1)))
    expect(key(view, 'Backspace')).toBe(true)
    expect(view.state.selection.head).toBe(heading!.pos + heading!.size - 1)
    expect(key(view, 'Delete')).toBe(true)
    expect(view.state.selection.head).toBe(action!.pos + 1)
    expect(prosemirrorToSutra(view.state.doc)).toBe(TEXT)
  })
})
