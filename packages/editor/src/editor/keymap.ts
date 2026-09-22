import { keymap } from 'prosemirror-keymap'
import { undo, redo } from 'prosemirror-history'
import { toggleMark } from 'prosemirror-commands'
import { TextSelection } from 'prosemirror-state'
import type { Command } from 'prosemirror-state'
import { schema } from './schema'
import { moveByGrapheme, extendByGrapheme } from './grapheme-cursor'

const smartEnter: Command = (state, dispatch) => {
  const { $from } = state.selection
  const node = $from.parent

  if (node.type === schema.nodes['frontmatter_field']) {
    // Enter moves to the next field, or exits into the body. New fields are
    // added via the pencil menu, never by splitting.
    if (dispatch) {
      const after = $from.after()
      dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(after), 1)))
    }
    return true
  }
  if (node.type === schema.nodes['scene_heading'] && $from.pos === $from.end()) {
    if (dispatch) {
      const actionType = schema.nodes['action']!
      const insertPos = $from.after()
      const tr = state.tr.insert(insertPos, actionType.create())
      dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1))))
    }
    return true
  }
  if (node.type === schema.nodes['character']) {
    if (dispatch) {
      const dialogueType = schema.nodes['dialogue']!
      const insertPos = $from.after()
      const tr = state.tr.insert(insertPos, dialogueType.create())
      dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1))))
    }
    return true
  }
  if (node.type === schema.nodes['dialogue'] || node.type === schema.nodes['parenthetical']) {
    if (dispatch) {
      const actionType = schema.nodes['action']!
      const insertPos = $from.after()
      const tr = state.tr.insert(insertPos, actionType.create())
      dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1))))
    }
    return true
  }
  // Every other block type (action, transition, centered, lyrics, section,
  // scene_metadata, note, comment…) has no dedicated rule above: split into
  // another node of the SAME type. Without an explicit `typesAfter`, PM's
  // default splitBlock command picks the first node type declared in the
  // `block` group in schema.ts (scene_heading) rather than preserving the
  // current type — so plain baseKeymap fallthrough silently turns the next
  // line into a scene heading.
  if (dispatch) {
    const tr = state.tr.split($from.pos, 1, [{ type: node.type }])
    dispatch(tr.scrollIntoView())
  }
  return true
}

export const keymapBindings: Record<string, Command> = {
  // Editing
  'Mod-z': undo,
  'Mod-y': redo,
  'Mod-Shift-Z': redo,
  'Mod-b': (state, dispatch) => {
    const mark = schema.marks['bold']!
    if (state.selection.empty) return false
    return toggleMark(mark)(state, dispatch)
  },
  'Mod-i': (state, dispatch) => {
    const mark = schema.marks['italic']!
    if (state.selection.empty) return false
    return toggleMark(mark)(state, dispatch)
  },
  'Mod-u': (state, dispatch) => {
    const mark = schema.marks['underline']!
    if (state.selection.empty) return false
    return toggleMark(mark)(state, dispatch)
  },
  'Enter': smartEnter,
  'Shift-Enter': (state, dispatch) => {
    const { $from } = state.selection
    if ($from.parent.type !== schema.nodes['frontmatter_field']) return false
    if (dispatch) {
      const br = schema.nodes['hard_break']!.create()
      dispatch(state.tr.replaceSelectionWith(br).scrollIntoView())
    }
    return true
  },
  'Tab': (state, _dispatch, view) => {
    const { $from } = state.selection
    if ($from.parent.type !== schema.nodes['scene_heading']) return false
    if (!view) return false
    const pos = $from.before()
    const domNode = view.nodeDOM(pos)
    const el = domNode instanceof HTMLElement ? domNode : (domNode as Node | null)?.parentElement
    const input = el?.querySelector<HTMLInputElement>('input.cs-scene-id-input')
    if (input) { input.focus(); input.select(); return true }
    return false
  },
  'ArrowDown': (state, dispatch) => {
    const { $from } = state.selection
    if ($from.parent.type !== schema.nodes['scene_heading']) return false
    // PM's built-in ArrowDown gets confused by the sibling scene-number input.
    // Explicitly jump to the start of the node after the scene heading.
    const afterPos = $from.after()
    if (afterPos > state.doc.content.size) return false
    if (dispatch) {
      dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(afterPos), 1)))
    }
    return true
  },
  'ArrowLeft': moveByGrapheme('left'),
  'ArrowRight': moveByGrapheme('right'),
  'Shift-ArrowLeft': extendByGrapheme('left'),
  'Shift-ArrowRight': extendByGrapheme('right'),
}

export function buildKeymap() {
  return keymap(keymapBindings)
}
