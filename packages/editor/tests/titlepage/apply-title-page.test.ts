import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { history, undo } from 'prosemirror-history'
import { parse } from '@sutrata/parser'
import { schema } from '../../src/editor/schema'
import { sutraToProsemirror } from '../../src/editor/sutra-to-prosemirror'
import { prosemirrorToSutra } from '../../src/editor/prosemirror-to-sutra'
import { applyTitlePageText } from '../../src/editor/frontmatter-field'
import { readTitlePage, writeTitlePage } from '../../src/titlepage/frontmatter-form'

const SRC = `---
title: The Last Train
author: Meera
---

## INT. STATION - NIGHT

Action line.
`

function mount(text: string) {
  const state = EditorState.create({ doc: sutraToProsemirror(parse(text)), schema, plugins: [history()] })
  return new EditorView(document.createElement('div'), { state })
}

describe('applyTitlePageText (formatted mode)', () => {
  it('swaps the title page in one undoable transaction and leaves the body alone', () => {
    const view = mount(SRC)
    const f = readTitlePage(parse(SRC).frontmatter!.data)
    const next = writeTitlePage(SRC, f, { ...f, author: 'Vikram', style: 'traditional' })
    const setText = vi.fn()

    applyTitlePageText(view, next, setText)

    expect(setText).not.toHaveBeenCalled()
    const out = prosemirrorToSutra(view.state.doc)
    expect(out).toContain('author: Vikram')
    expect(out).toContain('style: traditional')
    expect(out).toContain('Action line.')

    undo(view.state, view.dispatch)
    expect(prosemirrorToSutra(view.state.doc)).toContain('author: Meera')
    view.destroy()
  })

  it('inserts a title page when the document had none', () => {
    const body = '## INT. ROOM - DAY\n\nAction.\n'
    const view = mount(body)
    const f = readTitlePage(undefined)
    applyTitlePageText(view, writeTitlePage(body, f, { ...f, title: 'New Film' }), vi.fn())
    expect(view.state.doc.firstChild!.type.name).toBe('title_page')
    expect(prosemirrorToSutra(view.state.doc)).toContain('title: New Film')
    view.destroy()
  })

  it('falls back to setting the text when no editor view is mounted', () => {
    const setText = vi.fn()
    applyTitlePageText(null, 'X', setText)
    expect(setText).toHaveBeenCalledWith('X')
  })
})
