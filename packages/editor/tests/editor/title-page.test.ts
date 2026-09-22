import { describe, it, expect, afterEach } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { parse } from '@sutra/parser'
import { schema } from '../../src/editor/schema'
import { sutraToProsemirror } from '../../src/editor/sutra-to-prosemirror'
import { prosemirrorToSutra } from '../../src/editor/prosemirror-to-sutra'
import { keymapBindings } from '../../src/editor/keymap'
import { createAttrPencilPlugin } from '../../src/editor/attr-pencil-plugin'

const SAMPLE = `---
title:
  en: The Long Rain
  hi: लंबी बारिश
author: Sivaraj
custom_key: kept
---

## INT. KITCHEN - NIGHT

Action line.
`

describe('title_page bridge (frontmatter in the editor)', () => {
  it('renders frontmatter as a title_page node with dotted keys for nested maps', () => {
    const doc = sutraToProsemirror(parse(SAMPLE))
    const first = doc.firstChild!
    expect(first.type.name).toBe('title_page')
    const keys: string[] = []
    first.forEach(f => keys.push(f.attrs['fmKey'] as string))
    expect(keys).toEqual(['title.en', 'title.hi', 'author', 'custom_key'])
    expect(first.child(0).textContent).toBe('The Long Rain')
    expect(first.child(1).textContent).toBe('लंबी बारिश')
  })

  it('round-trips frontmatter through the editor bridge (fixes WYSIWYG frontmatter loss)', () => {
    const doc = sutraToProsemirror(parse(SAMPLE))
    const out = prosemirrorToSutra(doc)
    const reparsed = parse(out)
    expect(reparsed.frontmatter).not.toBeNull()
    expect(reparsed.frontmatter!.data).toEqual({
      title: { en: 'The Long Rain', hi: 'लंबी बारिश' },
      author: 'Sivaraj',
      custom_key: 'kept',
    })
    expect(out).toContain('## INT. KITCHEN - NIGHT')
    expect(out).toContain('Action line.')
  })

  it('does not invent a frontmatter block when none exists', () => {
    const doc = sutraToProsemirror(parse('## Scene 1\n\nAction.\n'))
    expect(doc.firstChild!.type.name).toBe('scene_heading')
    expect(prosemirrorToSutra(doc)).not.toContain('---')
  })

  it('Enter inside a frontmatter field moves to the next field without splitting', () => {
    const doc = sutraToProsemirror(parse(SAMPLE))
    let state = EditorState.create({ doc, schema })
    // Position 2 = inside the first field's content
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2)))
    expect(state.selection.$from.parent.attrs['fmKey']).toBe('title.en')

    let after: EditorState | null = null
    const handled = keymapBindings['Enter']!(state, tr => { after = state.apply(tr) })
    expect(handled).toBe(true)
    expect(after!.doc.eq(state.doc)).toBe(true) // no split, no new node
    expect(after!.selection.$from.parent.type.name).toBe('frontmatter_field')
    expect(after!.selection.$from.parent.attrs['fmKey']).toBe('title.hi')
  })
})

describe('attr pencil plugin', () => {
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    view = null
    document.querySelector('.cs-attr-menu')?.remove()
  })

  function mount(text: string): EditorView {
    const doc = sutraToProsemirror(parse(text))
    const state = EditorState.create({ doc, schema, plugins: [createAttrPencilPlugin()] })
    view = new EditorView(document.createElement('div'), { state })
    return view
  }

  it('renders a pencil widget on scene headings and the title page card', () => {
    const v = mount(SAMPLE)
    const pencils = v.dom.querySelectorAll('.cs-attr-pencil')
    expect(pencils.length).toBe(2)
    expect(v.dom.querySelectorAll('.cs-tp-pencil').length).toBe(1)
  })

  it('scene pencil menu inserts a metadata line with the picked key', () => {
    const v = mount(SAMPLE)
    const pencil = [...v.dom.querySelectorAll('.cs-attr-pencil')]
      .find(p => !p.classList.contains('cs-tp-pencil'))!
    pencil.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    const menu = document.querySelector('.cs-attr-menu')
    expect(menu).not.toBeNull()
    const statusItem = [...menu!.querySelectorAll('.cs-attr-menu-item')]
      .find(i => i.textContent === '+ status')!
    statusItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    const out = prosemirrorToSutra(v.state.doc)
    expect(out).toContain('## INT. KITCHEN - NIGHT\n& status:')
    // Cursor placed inside the new (empty) metadata node
    expect(v.state.selection.$from.parent.type.name).toBe('scene_metadata')
  })

  it('title page pencil opens the title page form instead of an add-field menu', () => {
    const v = mount(SAMPLE)
    const pencil = v.dom.querySelector('.cs-tp-pencil')!
    let opened = false
    window.addEventListener('cs:open-title-page', () => { opened = true })

    pencil.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    expect(opened).toBe(true)
    expect(document.querySelector('.cs-attr-menu')).toBeNull()
  })
})
