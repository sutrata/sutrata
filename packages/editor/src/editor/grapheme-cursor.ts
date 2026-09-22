import type { Command } from 'prosemirror-state'
import { EditorState, TextSelection, Transaction } from 'prosemirror-state'

/**
 * Segment text into grapheme clusters using Intl.Segmenter.
 * Falls back to codepoint-by-codepoint if Segmenter is unavailable.
 */
function getGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), (s: any) => s.segment)
  }
  // Fallback: iterate by Unicode codepoint (Array.from handles surrogates)
  return Array.from(text)
}

/**
 * Move cursor one grapheme cluster left or right.
 * Returns true if the command was applied, false if at a boundary.
 */
export function moveByGrapheme(dir: 'left' | 'right'): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
    const { selection, doc } = state
    const { $cursor } = selection as TextSelection

    // Only apply to collapsed (cursor) selections
    if (!$cursor) return false

    const pos = $cursor.pos

    if (dir === 'right') {
      // Get text from cursor to end of parent block
      const end = $cursor.end()
      if (pos >= end) return false
      const text = doc.textBetween(pos, end)
      const graphemes = getGraphemes(text)
      if (graphemes.length === 0) return false
      const advance = graphemes[0]?.length ?? 0
      if (advance === 0) return false
      if (dispatch) {
        const tr = state.tr.setSelection(TextSelection.create(doc, pos + advance))
        dispatch(tr)
      }
      return true
    } else {
      // dir === 'left'
      const start = $cursor.start()
      if (pos <= start) return false
      const text = doc.textBetween(start, pos)
      const graphemes = getGraphemes(text)
      if (graphemes.length === 0) return false
      const retreat = graphemes[graphemes.length - 1]?.length ?? 0
      if (dispatch) {
        const tr = state.tr.setSelection(TextSelection.create(doc, pos - retreat))
        dispatch(tr)
      }
      return true
    }
  }
}

/**
 * Extend selection one grapheme cluster left or right.
 */
export function extendByGrapheme(dir: 'left' | 'right'): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
    const { selection, doc } = state
    const { anchor, head } = selection

    if (dir === 'right') {
      const $head = doc.resolve(head)
      const end = $head.end()
      if (head >= end) return false
      const text = doc.textBetween(head, end)
      const graphemes = getGraphemes(text)
      if (graphemes.length === 0) return false
      const advance = graphemes[0]?.length ?? 0
      if (advance === 0) return false
      if (dispatch) {
        const tr = state.tr.setSelection(TextSelection.create(doc, anchor, head + advance))
        dispatch(tr)
      }
      return true
    } else {
      const $head = doc.resolve(head)
      const start = $head.start()
      if (head <= start) return false
      const text = doc.textBetween(start, head)
      const graphemes = getGraphemes(text)
      if (graphemes.length === 0) return false
      const retreat = graphemes[graphemes.length - 1]?.length ?? 0
      if (dispatch) {
        const tr = state.tr.setSelection(TextSelection.create(doc, anchor, head - retreat))
        dispatch(tr)
      }
      return true
    }
  }
}
