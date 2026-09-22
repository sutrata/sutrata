import { describe, it, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { schema } from '../../src/editor/schema'
import { moveByGrapheme, extendByGrapheme } from '../../src/editor/grapheme-cursor'

/**
 * ProseMirror position layout for an action node containing text T (length n):
 *   pos 1  = action open  (= $cursor.start())
 *   pos 2  = first UTF-16 code unit of T
 *   ...
 *   pos 1+n = action close  (= $cursor.end())
 *
 * Each JS string character (UTF-16 code unit) takes exactly 1 PM position.
 * Surrogate pairs (emoji, etc.) each take 2 positions in PM.
 *
 * Cursor at pos 1 is before the very first character (the true block-start).
 * Cursor at pos 1+n is after the last character (the true block-end).
 */
function makeState(text: string, cursorPos: number) {
  const doc = schema.node('doc', null, [
    schema.node('action', null, text ? [schema.text(text)] : []),
  ])
  const state = EditorState.create({ doc, schema })
  return state.apply(
    state.tr.setSelection(TextSelection.create(doc, cursorPos))
  )
}

describe('grapheme-cursor', () => {
  it('moveByGrapheme right advances over a single ASCII char', () => {
    // 'ABC': pos 1=start, pos 2='A', pos 3='B', pos 4='C', pos 5=end
    const state = makeState('ABC', 2) // cursor after 'A'... wait: pos 2 = after action_open = before 'A'?
    // No: pos 1 = action_open = start(). pos 2 = position after first char 'A'.
    // Actually: textBetween(1, 4) = 'ABC' → positions 1..4 map to chars A,B,C.
    // So pos 1 is before 'A', pos 2 is between 'A' and 'B', pos 3 is between 'B' and 'C', pos 4 is after 'C'.
    // Cursor at pos 1: textBetween(1, 4) = 'ABC', first grapheme 'A' (len 1) → advance to pos 2.
    // Cursor at pos 2: textBetween(2, 4) = 'BC', first grapheme 'B' → advance to pos 3. ✓
    let dispatched: any = null
    moveByGrapheme('right')(state, (tr) => { dispatched = tr })
    expect(dispatched).not.toBeNull()
    const sel = dispatched.selection as TextSelection
    expect(sel.$cursor?.pos).toBe(3) // 'B' is next, advance by 1
  })

  it('moveByGrapheme right advances over the first grapheme in a Tamil sequence', () => {
    // 'க்ஷ' = U+0B95 U+0BCD U+0BB7 (3 BMP chars, 3 PM positions)
    // Node.js ICU segments 'க்ஷA' as ['க்'(len 2), 'ஷ'(len 1), 'A'(len 1)]
    // Cursor at pos 1 (block start, before 'க'): textBetween(1, 5) = 'க்ஷA'
    // First grapheme 'க்' has length 2 → cursor advances to pos 3.
    const cluster = 'க்ஷ'
    expect(cluster.length).toBe(3) // 3 UTF-16 code units
    const state = makeState(cluster + 'A', 1) // cursor at block start, before 'க'
    let dispatched: any = null
    moveByGrapheme('right')(state, (tr) => { dispatched = tr })
    expect(dispatched).not.toBeNull()
    const sel = dispatched.selection as TextSelection
    // Advances by 2 (length of first grapheme 'க்'), not by 1 (single codepoint)
    expect(sel.$cursor?.pos).toBe(3)
  })

  it('moveByGrapheme left retreats over a Tamil grapheme cluster', () => {
    // 'Aக்ஷ': pos 1=start, pos 2='A', pos 3='க', pos 4='்', pos 5='ஷ', end()=5
    // Cursor at pos 4 (after 'A','க','்'): textBetween(1, 4) = 'Aக்'
    // graphemes of 'Aக்' = ['A', 'க்'] → last grapheme 'க்' (len 2) → retreat by 2 → pos 2
    const cluster = 'க்ஷ'
    const state = makeState('A' + cluster, 4) // cursor after 'க்'
    let dispatched: any = null
    moveByGrapheme('left')(state, (tr) => { dispatched = tr })
    expect(dispatched).not.toBeNull()
    const sel = dispatched.selection as TextSelection
    // Retreats by 2 (length of 'க்'), landing before 'க'
    expect(sel.$cursor?.pos).toBe(2)
  })

  it('moveByGrapheme right advances over emoji ZWJ sequence as one grapheme', () => {
    // '👨‍👩‍👧' is a family ZWJ emoji — 1 grapheme cluster, 8 UTF-16 code units = 8 PM positions
    // Cursor at pos 1 (block start): textBetween(1, 9) = emoji string (length 8)
    // Intl.Segmenter gives 1 grapheme of length 8 → advance by 8 → pos 9
    const emoji = '👨‍👩‍👧'
    expect(emoji.length).toBe(8) // 8 UTF-16 code units
    const state = makeState(emoji, 1) // cursor at block start, before emoji
    let dispatched: any = null
    moveByGrapheme('right')(state, (tr) => { dispatched = tr })
    expect(dispatched).not.toBeNull()
    const sel = dispatched.selection as TextSelection
    // Should advance by 8 (full emoji = single grapheme)
    expect(sel.$cursor?.pos).toBe(1 + emoji.length) // 9
  })

  it('moveByGrapheme right returns false at end of block', () => {
    // 'A': start()=1, end()=2. Cursor at pos 2 (after 'A') → pos(2) >= end(2) → false
    const state = makeState('A', 2) // cursor after 'A', at block end
    const result = moveByGrapheme('right')(state, () => {})
    expect(result).toBe(false)
  })

  it('moveByGrapheme left returns false at start of block', () => {
    // start() = 1 for any inline content. Cursor at pos 1 → pos(1) <= start(1) → false
    const state = makeState('A', 1) // cursor at block start
    const result = moveByGrapheme('left')(state, () => {})
    expect(result).toBe(false)
  })

  it('extendByGrapheme right extends selection over first Tamil grapheme', () => {
    // 'க்ஷ': cursor at pos 1 (before 'க')
    // textBetween(head=1, end=4) = 'க்ஷ'
    // graphemes ['க்','ஷ'] → first='க்' (len 2) → head goes to 1+2=3
    // anchor stays at 1
    const cluster = 'க்ஷ'
    const state = makeState(cluster, 1) // cursor at block start
    let dispatched: any = null
    extendByGrapheme('right')(state, (tr) => { dispatched = tr })
    expect(dispatched).not.toBeNull()
    const sel = dispatched.selection as TextSelection
    expect(sel.head).toBe(3)   // extended by 2 (first grapheme 'க்')
    expect(sel.anchor).toBe(1) // anchor unchanged
  })
})
