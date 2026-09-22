import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { schema } from '../src/editor/schema'
import { makeSetBlock, makeSetOrToggleNote, makeToggleMark } from '../src/shell/toolbar-actions'

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

  it('applies the note_mark to a selected range, so an inline note can be created from the WYSIWYG toolbar', () => {
    const state = stateWith('action', 'Add the rain here please')
    const withSelection = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 1, 1 + 'Add the rain'.length))
    )
    let next = withSelection
    const applied = makeToggleMark('note_mark')(withSelection, (tr) => { next = withSelection.apply(tr) })
    expect(applied).toBe(true)

    const markType = schema.marks['note_mark']!
    let hasMark = false
    next.doc.firstChild!.descendants(node => {
      if (node.isText && node.marks.some(m => m.type === markType)) hasMark = true
    })
    expect(hasMark).toBe(true)
  })
})

function noteMarkedText(doc: EditorState['doc']): string {
  const markType = schema.marks['note_mark']!
  let text = ''
  doc.firstChild!.descendants(node => {
    if (node.isText && node.marks.some(m => m.type === markType)) text += node.text
  })
  return text
}

describe('makeSetOrToggleNote', () => {
  it('marks only the selected text as a note on an Action line, leaving the rest of the line intact', () => {
    const state = stateWith('action', 'Add the rain here please')
    const withSelection = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 1, 1 + 'Add the rain'.length))
    )
    let next = withSelection
    const applied = makeSetOrToggleNote()(withSelection, (tr) => { next = withSelection.apply(tr) })

    expect(applied).toBe(true)
    expect(next.doc.firstChild!.type.name).toBe('action')
    expect(noteMarkedText(next.doc)).toBe('Add the rain')
    expect(next.doc.textContent).toBe('Add the rain here please')
  })

  it('marks the whole line as a note on an Action line with no selection', () => {
    const state = stateWith('action', 'Add the rain here please')
    let next = state
    const applied = makeSetOrToggleNote()(state, (tr) => { next = state.apply(tr) })

    expect(applied).toBe(true)
    expect(next.doc.firstChild!.type.name).toBe('action')
    expect(noteMarkedText(next.doc)).toBe('Add the rain here please')
  })

  it('falls back to converting the whole block to a note element on any line other than Action', () => {
    const state = stateWith('dialogue', 'We should go home now.')
    const withSelection = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 1, 1 + 'We should'.length))
    )
    let next = withSelection
    const applied = makeSetOrToggleNote()(withSelection, (tr) => { next = withSelection.apply(tr) })

    expect(applied).toBe(true)
    expect(next.doc.firstChild!.type.name).toBe('note')
  })
})
