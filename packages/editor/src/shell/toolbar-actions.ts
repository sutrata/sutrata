import type { Command } from 'prosemirror-state'
import { TextSelection } from 'prosemirror-state'
import { toggleMark } from 'prosemirror-commands'
import { undo, redo } from 'prosemirror-history'
import { schema } from '../editor/schema'

export function makeSetBlock(typeName: string, attrs: Record<string, unknown> = {}): Command {
  return (state, dispatch) => {
    const nodeType = schema.nodes[typeName]
    if (!nodeType) return false
    if (dispatch) {
      const { from, to } = state.selection
      const tr = state.tr
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.isBlock && node.type.name !== 'doc') {
          tr.setNodeMarkup(pos, nodeType, { ...node.attrs, ...attrs })
        }
      })
      dispatch(tr)
    }
    return true
  }
}

export function makeToggleMark(markName: string): Command {
  return (state, dispatch) => {
    const mark = schema.marks[markName]
    if (!mark) return false
    if (state.selection.empty) return false
    return toggleMark(mark)(state, dispatch)
  }
}

// The "Note" toolbar button/shortcut does double duty: on an Action line it
// marks text as an inline [[ ]] note — the selection, or (with no selection)
// the whole line — leaving the line itself an Action. Inline notes aren't
// allowed on any other line type, so elsewhere it falls back to the original
// whole-block conversion to a standalone `note` block.
export function makeSetOrToggleNote(): Command {
  return (state, dispatch) => {
    const { $from, $to, empty } = state.selection
    const inAction = $from.parent.type.name === 'action' && (empty || $from.sameParent($to))
    if (!inAction) return makeSetBlock('note')(state, dispatch)

    const mark = schema.marks['note_mark']
    if (!mark) return false

    let target = state
    if (empty) {
      const lineStart = $from.start()
      const lineEnd = $from.end()
      if (lineEnd <= lineStart) return false
      target = state.apply(state.tr.setSelection(TextSelection.create(state.doc, lineStart, lineEnd)))
    }
    return toggleMark(mark)(target, dispatch)
  }
}

export { undo, redo }
