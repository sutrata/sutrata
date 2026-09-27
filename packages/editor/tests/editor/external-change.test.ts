import fc from 'fast-check'
import { EditorState, TextSelection } from 'prosemirror-state'
import { history, undo } from 'prosemirror-history'
import { parse } from '@sutrata/parser'
import { schema } from '../../src/editor/schema'
import { sutraToProsemirror } from '../../src/editor/sutra-to-prosemirror'
import { prosemirrorToSutra } from '../../src/editor/prosemirror-to-sutra'
import { externalChange, EXTERNAL_CHANGE } from '../../src/editor/external-change'

const doc = (text: string) => sutraToProsemirror(parse(text))
const stateOf = (text: string) => EditorState.create({ doc: doc(text), schema, plugins: [history()] })

const BASE = [
  '## INT. STATION - NIGHT {#1}', 'Meera waits.',
  '## EXT. PLATFORM - NIGHT {#2}', 'A train arrives.',
  '## INT. TRAIN - NIGHT {#3}', 'She boards.',
].join('\n\n') + '\n'

/** Position inside the first textblock whose text is `text`, at `offset`. */
function posIn(state: EditorState, text: string, offset: number): number {
  let found = -1
  state.doc.descendants((n, pos) => {
    if (found === -1 && n.isTextblock && n.textContent === text) found = pos + 1 + offset
    return found === -1
  })
  if (found === -1) throw new Error(`no block "${text}"`)
  return found
}

describe('externalChange', () => {
  it('equal documents: no transaction', () => {
    expect(externalChange(stateOf(BASE), doc(BASE))).toBeNull()
  })

  it('adds a scene reference line and keeps the cursor in another scene', () => {
    const next = BASE.replace('{#1}', '{#1}\n& x-sc-scene-id: 3f2a')
    let state = stateOf(BASE)
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, posIn(state, 'She boards.', 4))))
    const tr = externalChange(state, doc(next))!
    const after = state.apply(tr)
    expect(after.doc.eq(doc(next))).toBe(true)
    expect(after.selection.$from.parent.textContent).toBe('She boards.')
    expect(after.selection.$from.parentOffset).toBe(4)
    expect(tr.getMeta(EXTERNAL_CHANGE)).toBe(true)
    expect(tr.getMeta('addToHistory')).toBe(false)
  })

  it('is not undone by undo; the user edit before it is', () => {
    let state = stateOf(BASE)
    state = state.apply(state.tr.insertText(' alone', posIn(state, 'Meera waits.', 11)))
    const withUserEdit = prosemirrorToSutra(state.doc)
    const next = withUserEdit.replace('A train arrives.', 'Two trains arrive.')
    state = state.apply(externalChange(state, doc(next))!)
    let undone = state
    undo(state, tr => { undone = state.apply(tr) })
    const text = prosemirrorToSutra(undone.doc)
    expect(text).toContain('Two trains arrive.')
    expect(text).not.toContain('waits alone')
  })

  it('replaces only the blocks that changed, in several places', () => {
    const next = BASE.replace('Meera waits.', 'Meera waits, alone.').replace('She boards.', 'She boards, late.')
    let state = stateOf(BASE)
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, posIn(state, 'A train arrives.', 2))))
    const tr = externalChange(state, doc(next))!
    expect(tr.steps).toHaveLength(2)
    const after = state.apply(tr)
    expect(after.doc.eq(doc(next))).toBe(true)
    expect(after.selection.$from.parent.textContent).toBe('A train arrives.')
    expect(after.selection.$from.parentOffset).toBe(2)
  })

  it('a reorder, a deletion and an insertion', () => {
    const scenes = BASE.trim().split('\n\n## ')
    const next = ['## ' + scenes[2], scenes[0], '## EXT. RIVER - DAY {#4}\n\nWater.'].join('\n\n') + '\n'
    const state = stateOf(BASE)
    expect(state.apply(externalChange(state, doc(next))!).doc.eq(doc(next))).toBe(true)
  })

  it('turns any document into any other (property)', () => {
    const block = fc.constantFrom(
      '## INT. A {#1}', '## EXT. B {#2}\n& x-sc-scene-id: r1', '## INT. C\n& synopsis: s\n& x-sc-scene-id: r2',
      'Action one.', 'Action two, **bold**.', '@MEERA\nHello.', '@RAVI\n(softly)\nWhat?', '>> CUT TO:',
      '# ACT ONE', '~ a lyric', '[[a note]]', '===', 'மீரா காத்திருக்கிறாள்.',
    )
    const text = fc.array(block, { minLength: 1, maxLength: 15 }).map(bs => bs.join('\n\n') + '\n')
    const withTitle = fc.tuple(fc.boolean(), text).map(([t, s]) => (t ? '---\ntitle: T\n---\n\n' : '') + s)
    fc.assert(fc.property(withTitle, withTitle, (a, b) => {
      const state = stateOf(a)
      const tr = externalChange(state, doc(b))
      const after = tr ? state.apply(tr).doc : state.doc
      expect(after.eq(doc(b))).toBe(true)
    }), { numRuns: 300 })
  })
})
