import { DOMSerializer } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import JSZip from 'jszip'
import { parse, exportFountain } from '@sutrata/parser'
import { schema } from '../../src/editor/schema'
import { buildPlugins } from '../../src/editor/plugins'
import { sutraToProsemirror } from '../../src/editor/sutra-to-prosemirror'
import { prosemirrorToSutra } from '../../src/editor/prosemirror-to-sutra'
import { FrontmatterFieldView } from '../../src/editor/frontmatter-field-view'
import { readTitlePage, writeTitlePage } from '../../src/titlepage/frontmatter-form'
import { exportToDocx } from '../../src/file/docx-exporter'
import { openScreenplayPrintPreview } from '../../src/file/workflow-reports'

// Tool-private frontmatter keys (format spec §5, §7.1), e.g. a hosted service's base-commit key.
const ID = '0f8e2c4a-1b2c-4d5e-8f90-123456789abc'
const TEXT = `---\nx-sc-base-commit: ${ID}\ntitle: Last Train\nauthor: Meera\n---\n\n## INT. STATION - NIGHT {#1}\n\nMeera waits.\n`

const stateOf = (text: string) => EditorState.create({ doc: sutraToProsemirror(parse(text)), schema, plugins: buildPlugins() })

/** Position inside the title-page field for `key`, at its start. */
function fieldPos(state: EditorState, key: string): number {
  let found = -1
  state.doc.descendants((n, pos) => {
    if (found === -1 && n.type.name === 'frontmatter_field' && n.attrs['fmKey'] === key) found = pos + 1
    return found === -1
  })
  return found
}

describe('tool-private x- frontmatter keys', () => {
  it('are hidden on the title page (schema DOM and node view)', () => {
    const state = stateOf(TEXT)
    const page = state.doc.child(0)
    const field = page.child(0)
    expect(field.attrs['fmKey']).toBe('x-sc-base-commit')
    const dom = DOMSerializer.fromSchema(schema).serializeNode(field) as HTMLElement
    expect(dom.dataset['private']).toBe('true')
    const view = new FrontmatterFieldView(field, {} as EditorView, () => 0)
    expect(view.dom.dataset['private']).toBe('true')
    const title = new FrontmatterFieldView(page.child(1), {} as EditorView, () => 0)
    expect(title.dom.dataset['private']).toBeUndefined()
  })

  it('keep the caret out: a selection inside moves to a visible field', () => {
    let state = stateOf(TEXT)
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, fieldPos(state, 'x-sc-base-commit') + 3)))
    expect(state.selection.$head.parent.attrs['fmKey']).toBe('title')
  })

  it('Backspace at the start of the next field steps over it instead of merging', () => {
    const state = stateOf(TEXT)
    const view = new EditorView(document.createElement('div'), { state, plugins: [] } as never)
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, fieldPos(view.state, 'title'))))
    const handled = view.someProp('handleKeyDown', f => f(view, new KeyboardEvent('keydown', { key: 'Backspace' })))
    expect(handled).toBe(true)
    expect(prosemirrorToSutra(view.state.doc)).toBe(TEXT)
    expect(view.state.selection.$head.parent.attrs['fmKey']).not.toBe('x-sc-base-commit')
    view.destroy()
  })

  it('survive editing the title page, byte for byte', () => {
    let state = stateOf(TEXT)
    state = state.apply(state.tr.insertText('The ', fieldPos(state, 'title')))
    expect(prosemirrorToSutra(state.doc)).toBe(TEXT.replace('title: Last Train', 'title: The Last Train'))
  })

  it('a document whose frontmatter holds only an x- key keeps it', () => {
    const only = `---\nx-sc-base-commit: ${ID}\n---\n\n## INT. A {#1}\n\nAction.\n`
    expect(prosemirrorToSutra(stateOf(only).doc)).toBe(only)
  })

  it('are not rows in the title page form, and saving the form keeps them', () => {
    const form = readTitlePage(parse(TEXT).frontmatter!.data)
    expect(form.custom.map(c => c.key)).not.toContain('x-sc-base-commit')
    const written = writeTitlePage(TEXT, form, { ...form, title: 'The Last Train' })
    expect(written).toContain(`x-sc-base-commit: ${ID}`)
    expect(written).toContain('title: The Last Train')
  })

  it('are never printed or exported', async () => {
    const ast = parse(TEXT)
    expect(exportFountain(ast).text).not.toContain(ID)

    const zip = await JSZip.loadAsync(await (await exportToDocx(ast)).arrayBuffer())
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('LAST TRAIN')
    expect(xml).not.toContain(ID)

    const originalOpen = window.open
    let written = ''
    window.open = (() => ({ document: { write: (html: string) => { written = html }, close: () => {} } })) as never
    try {
      await openScreenplayPrintPreview(ast)
    } finally {
      window.open = originalOpen
    }
    expect(written).toContain('Last Train')
    expect(written).not.toContain(ID)
  })
})
