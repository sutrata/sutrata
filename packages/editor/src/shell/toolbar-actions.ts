import type { Command } from 'prosemirror-state'
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

export { undo, redo }
