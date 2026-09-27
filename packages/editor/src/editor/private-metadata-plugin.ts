import { Plugin, Selection, TextSelection, type EditorState, type Transaction } from 'prosemirror-state'
import type { ResolvedPos } from 'prosemirror-model'
import type { Node as PmNode } from 'prosemirror-model'

/**
 * Tool-private `x-` scene metadata and frontmatter keys (format spec §5, §7.1)
 * stay in the document but are hidden (`data-private`, see schema.ts). This
 * plugin keeps the caret out of those hidden blocks and title-page fields and
 * stops Backspace/Delete from merging text into or out of them; a range
 * deletion that spans one still removes it.
 */

export function isPrivateBlock(node: PmNode | null | undefined): boolean {
  return !!node && node.type.name === 'scene_metadata' && (node.attrs['metaKey'] as string).startsWith('x-')
}

/** A hidden `x-` field of the title page. */
export function isPrivateField(node: PmNode | null | undefined): boolean {
  return !!node && node.type.name === 'frontmatter_field' && (node.attrs['fmKey'] as string).startsWith('x-')
}

function isHidden($pos: ResolvedPos): boolean {
  return ($pos.depth >= 1 && isPrivateBlock($pos.node(1))) || isPrivateField($pos.parent)
}

/** The nearest text selection outside hidden blocks and fields, from a hidden field at `$head`. */
function leaveField(state: EditorState, $head: ResolvedPos, dir: 1 | -1): Transaction | null {
  for (const d of [dir, -dir as 1 | -1]) {
    let pos = d === 1 ? $head.after() : $head.before()
    for (;;) {
      const sel = Selection.findFrom(state.doc.resolve(pos), d, true)
      if (!sel) break
      if (!isHidden(sel.$head)) return state.tr.setSelection(sel)
      pos = d === 1 ? sel.$head.after() : sel.$head.before()
    }
  }
  return null
}

/** Position just inside the nearest visible top-level block from `index` in `dir`, or null. */
function visibleBlockPos(doc: PmNode, index: number, dir: 1 | -1): number | null {
  for (let i = index; i >= 0 && i < doc.childCount; i += dir) {
    if (isPrivateBlock(doc.child(i))) continue
    let pos = 0
    for (let j = 0; j < i; j++) pos += doc.child(j).nodeSize
    return dir === 1 ? pos + 1 : pos + doc.child(i).nodeSize - 1
  }
  return null
}

function moveOut(state: EditorState, index: number, dir: 1 | -1): Transaction | null {
  const pos = visibleBlockPos(state.doc, index, dir) ?? visibleBlockPos(state.doc, index, dir === 1 ? -1 : 1)
  return pos === null ? null : state.tr.setSelection(TextSelection.near(state.doc.resolve(pos), dir))
}

export function createPrivateMetadataPlugin(): Plugin {
  return new Plugin({
    appendTransaction(trs, oldState, state) {
      const { $head, empty } = state.selection
      if (!empty || !trs.some(tr => tr.selectionSet || tr.docChanged)) return null
      const dir = $head.pos < oldState.selection.head ? -1 : 1
      if (isPrivateField($head.parent)) return leaveField(state, $head, dir)
      if ($head.depth < 1 || !isPrivateBlock($head.node(1))) return null
      return moveOut(state, $head.index(0), dir)
    },
    props: {
      handleKeyDown(view, event) {
        if (event.key !== 'Backspace' && event.key !== 'Delete') return false
        const { $head, empty } = view.state.selection
        if (!empty) return false
        const back = event.key === 'Backspace'
        if ($head.parent.type.name === 'frontmatter_field') {
          // Between title-page fields: step over hidden ones instead of merging.
          if (back ? $head.parentOffset !== 0 : $head.parentOffset !== $head.parent.content.size) return false
          const page = $head.node($head.depth - 1)
          const neighbour = $head.index($head.depth - 1) + (back ? -1 : 1)
          if (neighbour < 0 || neighbour >= page.childCount || !isPrivateField(page.child(neighbour))) return false
          const tr = leaveField(view.state, view.state.doc.resolve(back ? $head.before() - 1 : $head.after() + 1), back ? -1 : 1)
          if (tr) view.dispatch(tr)
          return true
        }
        if ($head.depth !== 1) return false
        if (back ? $head.parentOffset !== 0 : $head.parentOffset !== $head.parent.content.size) return false
        const index = $head.index(0)
        const neighbour = back ? index - 1 : index + 1
        if (neighbour < 0 || neighbour >= view.state.doc.childCount || !isPrivateBlock(view.state.doc.child(neighbour))) return false
        // Step over the hidden block(s) instead of merging with them.
        const tr = moveOut(view.state, neighbour, back ? -1 : 1)
        if (tr) view.dispatch(tr)
        return true
      },
    },
  })
}
