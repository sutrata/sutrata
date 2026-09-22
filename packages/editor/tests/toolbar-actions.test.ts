import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { schema } from '../src/editor/schema'
import { makeSetBlock, makeToggleMark } from '../src/shell/toolbar-actions'

function stateWith(typeName: string, text: string) {
  const node = schema.nodes[typeName]!.create(null, text ? schema.text(text) : undefined)
  const doc = schema.nodes['doc']!.create(null, node)
  let state = EditorState.create({ schema, doc })
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1)))
  return state
}

describe('makeSetBlock', () => {
  it('changes the current block type', () => {
    const state = stateWith('action', 'hello')
    let next = state
    makeSetBlock('character')(state, (tr) => { next = state.apply(tr) })
    expect(next.doc.firstChild!.type.name).toBe('character')
  })
})

describe('makeToggleMark', () => {
  it('returns false on empty selection (does nothing)', () => {
    const state = stateWith('action', 'hello')
    const result = makeToggleMark('bold')(state, () => {})
    expect(result).toBe(false)
  })
})
