import React from 'react'
import { render, act } from '@testing-library/react'
import { vi } from 'vitest'
import { TextSelection } from 'prosemirror-state'
import { undo } from 'prosemirror-history'
import { undo as sourceUndo } from '@codemirror/commands'
import { AppShell } from '../../src/shell/AppShell'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'
import { LanguageProvider } from '../../src/i18n/LanguageContext'
import { TranslationProvider } from '../../src/i18n/useTranslation'
import { getEditorView, getSourceView } from '../../src/editor/editor-bus'
import type { SaveResult, StorageAdapter } from '../../src/extensions/storage-adapter'

const TEXT = [
  '## INT. STATION - NIGHT {#1}', 'Meera waits.',
  '## EXT. PLATFORM - NIGHT {#2}', 'A train arrives.',
].join('\n\n') + '\n'
const WITH_REF = TEXT.replace('{#1}', '{#1}\n& x-sc-scene-id: 3f2a')

type Doc = ReturnType<typeof useDocument>
let ctx: Doc
function Probe() {
  ctx = useDocument()
  return null
}

function storage(saveDocument: StorageAdapter['saveDocument'], subscribe?: StorageAdapter['subscribe']): StorageAdapter {
  return {
    saveDocument,
    subscribe,
    loadDocument: vi.fn().mockResolvedValue(null),
    listVersions: vi.fn().mockResolvedValue([]),
    openFile: vi.fn().mockResolvedValue(null),
    openDocx: vi.fn().mockResolvedValue(null),
    openStyleJson: vi.fn().mockResolvedValue(null),
    saveFile: vi.fn().mockResolvedValue(null),
    saveStyle: vi.fn().mockResolvedValue(undefined),
    loadAllStyles: vi.fn().mockResolvedValue([]),
    deleteStyle: vi.fn().mockResolvedValue(undefined),
  }
}

/** Mounts the editor on document `doc-1` holding TEXT. */
async function mount(adapter: StorageAdapter) {
  await act(async () => {
    render(
      <TranslationProvider>
        <DocumentProvider storageAdapter={adapter}>
          <LanguageProvider>
            <Probe />
            <AppShell />
          </LanguageProvider>
        </DocumentProvider>
      </TranslationProvider>,
    )
  })
  await act(async () => {
    ctx.setFilePath('doc-1')
    ctx.setText(TEXT)
  })
}

/** Types `insert` at `offset` in the block whose text is `block`, as the user. */
function type(block: string, offset: number, insert: string) {
  const view = getEditorView()!
  let pos = -1
  view.state.doc.descendants((n, p) => {
    if (pos === -1 && n.isTextblock && n.textContent === block) pos = p + 1 + offset
    return pos === -1
  })
  act(() => { view.dispatch(view.state.tr.insertText(insert, pos)) })
}

function cursorIn(block: string, offset: number) {
  const view = getEditorView()!
  let pos = -1
  view.state.doc.descendants((n, p) => {
    if (pos === -1 && n.isTextblock && n.textContent === block) pos = p + 1 + offset
    return pos === -1
  })
  act(() => { view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos))) })
}

describe('StorageAdapter sync members (OSS spec §11.5)', () => {
  it('applies a SaveResult: not undoable, not a user edit, cursor kept', async () => {
    const save = vi.fn(async (_p: string, content: string): Promise<SaveResult> =>
      ({ content: content.replace('{#1}', '{#1}\n& x-sc-scene-id: 3f2a') }))
    await mount(storage(save))
    type('Meera waits.', 11, ' alone')
    cursorIn('A train arrives.', 2)
    const dirtyBefore = ctx.isDirty
    await act(async () => { await ctx.save() })

    expect(save).toHaveBeenCalledWith('doc-1', expect.stringContaining('waits alone'))
    expect(ctx.text).toContain('& x-sc-scene-id: 3f2a')
    expect(ctx.text).toContain('waits alone')
    expect(ctx.isDirty).toBe(dirtyBefore)
    const view = getEditorView()!
    expect(view.state.selection.$from.parent.textContent).toBe('A train arrives.')
    expect(view.state.selection.$from.parentOffset).toBe(2)

    act(() => { undo(view.state, view.dispatch) })
    expect(ctx.text).toContain('& x-sc-scene-id: 3f2a')
    expect(ctx.text).not.toContain('waits alone')
  })

  it('a SaveResult does not make a clean document dirty', async () => {
    await mount(storage(vi.fn(async (): Promise<SaveResult> => ({ content: WITH_REF }))))
    act(() => { ctx.markClean() })
    await act(async () => { await ctx.save() })
    expect(ctx.text).toContain('x-sc-scene-id')
    expect(ctx.isDirty).toBe(false)
  })

  it('drops a SaveResult when the user typed while the save was in flight', async () => {
    let finish: (r: SaveResult) => void = () => {}
    const save = vi.fn(() => new Promise<SaveResult>(r => { finish = r }))
    await mount(storage(save))
    type('Meera waits.', 11, ' alone')
    let saving: Promise<void> = Promise.resolve()
    act(() => { saving = ctx.save() })
    type('A train arrives.', 16, ' Late.')
    await act(async () => { finish({ content: WITH_REF }); await saving })
    expect(ctx.text).not.toContain('x-sc-scene-id')
    expect(ctx.text).toContain('waits alone')
    expect(ctx.text).toContain('arrives. Late.')
  })

  it('does not save again when nothing changed since the last save', async () => {
    const save = vi.fn(async () => undefined)
    await mount(storage(save))
    await act(async () => { await ctx.save() })
    await act(async () => { await ctx.save() })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('a local adapter (void result) changes nothing', async () => {
    await mount(storage(vi.fn(async () => undefined)))
    await act(async () => { await ctx.save() })
    expect(ctx.text).toBe(TEXT)
  })

  it('applies remote updates only while there are no unsaved edits', async () => {
    let onRemote: (content: string) => void = () => {}
    const unsubscribe = vi.fn()
    const subscribe = vi.fn((path: string, cb: (c: string) => void) => { onRemote = cb; return unsubscribe })
    await mount(storage(vi.fn(async () => undefined), subscribe))
    expect(subscribe).toHaveBeenCalledWith('doc-1', expect.any(Function))
    await act(async () => { await ctx.save() })

    act(() => { onRemote(TEXT.replace('A train arrives.', 'Two trains arrive.')) })
    expect(ctx.text).toContain('Two trains arrive.')

    type('Meera waits.', 11, ' alone')
    act(() => { onRemote(TEXT.replace('A train arrives.', 'Three trains arrive.')) })
    expect(ctx.text).not.toContain('Three trains')
    expect(ctx.text).toContain('waits alone')

    await act(async () => { ctx.setFilePath('doc-2') })
    expect(unsubscribe).toHaveBeenCalled()
    expect(subscribe).toHaveBeenLastCalledWith('doc-2', expect.any(Function))
  })

  it('source mode: applies the change outside undo history', async () => {
    const save = vi.fn(async (): Promise<SaveResult> => ({ content: WITH_REF }))
    await mount(storage(save))
    await act(async () => { ctx.setMode('source') })
    const cm = getSourceView()!
    act(() => { cm.dispatch({ changes: { from: cm.state.doc.length, insert: '\nMore.\n' } }) })
    save.mockImplementation(async (_p: string, content: string) => ({ content: content.replace('{#1}', '{#1}\n& x-sc-scene-id: 3f2a') }))
    await act(async () => { await ctx.save() })
    expect(cm.state.doc.toString()).toContain('& x-sc-scene-id: 3f2a')
    act(() => { sourceUndo(cm) })
    expect(cm.state.doc.toString()).toContain('& x-sc-scene-id: 3f2a')
    expect(cm.state.doc.toString()).not.toContain('More.')
  })
})
