import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { schema } from '../../src/editor/schema'

vi.mock('../../src/spellcheck/client', () => ({
  misspelledWords: vi.fn(async (code: string, _file: string, _base: string, words: string[]) =>
    words.filter(w => (code === 'en' ? ['helo', 'kannan', 'vennila'].includes(w.toLowerCase()) : w === 'வணகம்'))),
  suggestionsFor: vi.fn(async () => []),
}))

import { createSpellcheckPlugin, resetSpellcheckCache } from '../../src/spellcheck/spellcheck-plugin'
import { updateSpellcheck, ignoreWord, unignoreWord } from '../../src/spellcheck/settings'

function mount(blocks: Array<[string, string]>) {
  const doc = schema.node('doc', null, blocks.map(([type, text]) => schema.node(type, null, text ? [schema.text(text)] : [])))
  const plugin = createSpellcheckPlugin()
  const view = new EditorView(document.createElement('div'), { state: EditorState.create({ doc, plugins: [plugin] }) })
  return view
}
const underlined = (view: EditorView) =>
  [...view.dom.querySelectorAll('.cs-spell-error')].map(e => e.textContent)

describe('spell check underlines', () => {
  beforeEach(() => { resetSpellcheckCache(); updateSpellcheck({ enabled: false, regional: '', ignored: [] }) })
  afterEach(() => vi.useRealTimers())

  it('underlines nothing while off', async () => {
    const view = mount([['action', 'helo there']])
    await new Promise(r => setTimeout(r, 50))
    expect(underlined(view)).toEqual([])
  })

  it('underlines English and regional misspellings, but not headings or character names', async () => {
    updateSpellcheck({ enabled: true, regional: 'ta' })
    const view = mount([
      ['scene_heading', 'INT. helo - DAY'],
      ['character', 'BOB'],
      ['action', 'She says helo to everyone.'],
      ['dialogue', 'helo வணகம் வணக்கம்'],
    ])
    await vi.waitFor(() => expect(underlined(view).length).toBeGreaterThan(0))
    expect(underlined(view)).toEqual(['helo', 'helo', 'வணகம்'])
  })

  it('checks English only when no regional language is chosen', async () => {
    updateSpellcheck({ enabled: true, regional: '' })
    const view = mount([['action', 'helo வணகம்']])
    await vi.waitFor(() => expect(underlined(view)).toEqual(['helo']))
  })

  it('ignores character names, and stops once the character is gone', async () => {
    updateSpellcheck({ enabled: true, regional: '' })
    const view = mount([
      ['character', 'KANNAN (V.O.)'],
      ['dialogue', 'helo'],
      ['action', 'Kannan and Vennila wait.'],
    ])
    await vi.waitFor(() => expect(underlined(view)).toEqual(['helo', 'Vennila']))
    // The character cue is deleted: the name is a misspelling again.
    view.dispatch(view.state.tr.delete(0, view.state.doc.child(0).nodeSize))
    await vi.waitFor(() => expect(underlined(view)).toEqual(['helo', 'Kannan', 'Vennila']))
  })

  it('ignores words the writer ignored, until they are taken off the list', async () => {
    updateSpellcheck({ enabled: true, regional: '' })
    const view = mount([['action', 'Vennila says helo']])
    await vi.waitFor(() => expect(underlined(view)).toEqual(['Vennila', 'helo']))
    ignoreWord('Vennila')
    await vi.waitFor(() => expect(underlined(view)).toEqual(['helo']))
    unignoreWord('vennila')
    await vi.waitFor(() => expect(underlined(view)).toEqual(['Vennila', 'helo']))
  })
})
