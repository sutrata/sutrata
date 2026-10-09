import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state'
import { schema } from './schema'

/**
 * Position just after a scene heading and the `scene_metadata` blocks that
 * follow it (synopsis, the hidden `x-sc-scene-id`, ...). Anything inserted
 * before them would end the heading's metadata block in the Sutra text, so
 * the metadata would turn into action lines.
 */
export function afterHeadingMetadata(state: EditorState, headingPos: number): number {
  const { doc } = state
  const heading = doc.nodeAt(headingPos)
  let pos = headingPos + (heading?.nodeSize ?? 0)
  for (;;) {
    const next = doc.nodeAt(pos)
    if (!next || next.type !== schema.nodes['scene_metadata']) return pos
    pos += next.nodeSize
  }
}

/** An empty action line after the heading's metadata, with the caret in it. */
export function insertActionAfterHeading(state: EditorState, headingPos: number): Transaction {
  const insertPos = afterHeadingMetadata(state, headingPos)
  const tr = state.tr.insert(insertPos, schema.nodes['action']!.create())
  return tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1))).scrollIntoView()
}
