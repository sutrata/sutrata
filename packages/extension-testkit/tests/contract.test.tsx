/**
 * Extension contract: mounts the editor through its public entry point with
 * a stub for every extension point and checks each one is actually used.
 * Runs against the *built* @sutrata/editor (dist/), so it also catches
 * missing exports.
 */
import React from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { Plugin, TextSelection } from 'prosemirror-state'
import { undo } from 'prosemirror-history'
import {
  DocumentProvider, AppShell, useDocument, LanguageProvider, TranslationProvider, createRegistries,
} from '@sutrata/editor'
import type { DocumentProviderProps } from '@sutrata/editor'
import {
  createMemoryStorage, createStubAI, createStubSpeech, createSession, createStubDecorations, createStubCollab,
} from '../src'

const TEXT = '## INT. HOUSE - DAY {#1}\n\nMeera waits.\n\n## EXT. PARK - NIGHT {#2}\n\nRain.\n'

let doc!: ReturnType<typeof useDocument>
function Probe({ text }: { text: string }) {
  doc = useDocument()
  React.useEffect(() => { doc.setText(text) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

async function mount(props: Partial<DocumentProviderProps> = {}, text = TEXT) {
  const collab = createStubCollab()
  const storage = createMemoryStorage()
  const result = await act(async () => render(
    <TranslationProvider>
      <DocumentProvider storageAdapter={storage} collabBinding={collab} {...props}>
        <LanguageProvider>
          <Probe text={text} />
          <AppShell />
        </LanguageProvider>
      </DocumentProvider>
    </TranslationProvider>,
  ))
  // The collab stub hands us the formatted editor's view, via the public API only.
  const view = (props.collabBinding as ReturnType<typeof createStubCollab> | undefined)?.view ?? collab.view!
  return { ...result, storage: (props.storageAdapter as ReturnType<typeof createMemoryStorage> | undefined) ?? storage, view }
}

describe('StorageAdapter', () => {
  it('Save writes the document through the adapter', async () => {
    const storage = createMemoryStorage()
    await mount({ storageAdapter: storage })
    await act(async () => { fireEvent.keyDown(window, { code: 'KeyS', ctrlKey: true }) })
    await waitFor(() => expect([...storage.files.values()]).toContain(TEXT))
  })
})

describe('AIProvider', () => {
  it('synopsis generation goes through the stub provider', async () => {
    const ai = createStubAI()
    await mount({ aiProvider: ai })
    await act(async () => {
      fireEvent.click(screen.getAllByLabelText('Generate synopsis & estimate duration')[0]!)
    })
    await waitFor(() => expect(doc.text).toContain('& synopsis: Stub synopsis.'))
    expect(ai.calls).toHaveLength(1)
    expect(ai.calls[0]!.prompt).toContain('INT. HOUSE - DAY')
  })

  it('status bar shows provider activity', async () => {
    const ai = createStubAI()
    await mount({ aiProvider: ai })
    act(() => ai.setActivity([{ label: 'Stub model' }]))
    expect(screen.getByText('Calling Stub model...')).toBeInTheDocument()
  })

  it('an unconfigured provider is asked to open its setup', async () => {
    const ai = createStubAI()
    ai.configured = false
    await mount({ aiProvider: ai })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Generate synopsis & estimate duration (all scenes)'))
    })
    await waitFor(() => expect(ai.setupOpened).toBe(1))
    expect(ai.calls).toHaveLength(0)
  })
})

describe('SpeechProvider', () => {
  it('voice dictation appears with speech + AI and listens through the stub', async () => {
    const speech = createStubSpeech()
    await mount({ aiProvider: createStubAI(), speechProvider: speech })
    fireEvent.click(screen.getByLabelText('Voice Dictation'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Start Dictation/ })) })
    expect(speech.active).not.toBeNull()
    act(() => speech.say('scene one'))
    expect(screen.getByText(/scene one/)).toBeInTheDocument()
  })
})

describe('SessionContext', () => {
  it('a read session blocks edits', async () => {
    const collab = createStubCollab()
    const { view } = await mount({ session: createSession('read'), collabBinding: collab })
    expect(view.editable).toBe(false)
    act(() => { view.dispatch(view.state.tr.insertText('X', 1)) })
    expect(doc.text).toBe(TEXT)
    expect(screen.queryByLabelText('Save')).toBeNull()
  })

  it('feature flags switch AI off', async () => {
    await mount({ aiProvider: createStubAI(), session: createSession('edit', { ai: false }) })
    expect(screen.queryByLabelText('Generate synopsis & estimate duration (all scenes)')).toBeNull()
  })
})

describe('Registries', () => {
  it('a registered panel, command (with shortcut) and exporter appear and run', async () => {
    const r = createRegistries()
    const run = vi.fn()
    const exportRun = vi.fn(async () => new Blob(['fdx']))
    r.panels.register({ id: 'notes', title: 'Notes', location: 'sidebar', render: ctx => <p>{ctx.sceneIds.length} scenes</p> })
    r.commands.register({ id: 'stamp', label: 'Stamp', menu: 'appbar', shortcut: 'Mod-Shift-K', run })
    r.exporters.register({
      id: 'fdx', label: 'Final Draft (.fdx)', group: 'screenplay', run: exportRun, fileName: c => `${c.baseName}.fdx`,
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await mount({ panels: r.panels, commands: r.commands, exporters: r.exporters })

    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(screen.getByRole('tabpanel', { name: 'Notes' })).toHaveTextContent('2 scenes')

    fireEvent.click(screen.getByRole('button', { name: 'Stamp' }))
    await act(async () => { fireEvent.keyDown(window, { code: 'KeyK', ctrlKey: true, shiftKey: true }) })
    expect(run).toHaveBeenCalledTimes(2)

    await act(async () => { doc.setExportVisible(true) })
    fireEvent.click(screen.getByText('Final Draft (.fdx)'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Download' })) })
    expect(exportRun).toHaveBeenCalledTimes(1)
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe('screenplay.fdx')
    click.mockRestore()
  })
})

describe('DecorationProvider', () => {
  it('a decoration renders at its scene-relative anchor and re-renders on change', async () => {
    const decorations = createStubDecorations()
    const { container } = await mount({ decorationProviders: [decorations] })
    act(() => decorations.set(ctx => {
      const from = ctx.sceneText('2')!.indexOf('Rain')
      return [{ kind: 'inline', anchor: { sceneId: '2', from, to: from + 4 }, className: 'kit-highlight' }]
    }))
    expect(container.querySelector('.kit-highlight')?.textContent).toBe('Rain')
  })
})

describe('CollabBinding', () => {
  it('its plugins are installed and attach() receives the view', async () => {
    const marker = new Plugin({})
    const collab = createStubCollab(() => [marker])
    const { view, unmount } = await mount({ collabBinding: collab })
    expect(collab.attached).toBe(1)
    expect(view.state.plugins).toContain(marker)
    // The view is live: selection changes flow through it.
    act(() => { view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2))) })
    expect(view.state.selection.from).toBe(2)
    unmount()
    expect(collab.detached).toBe(1)
  })
})

describe('AI-assisted import', () => {
  it('formats pasted text through the provider and imports it as one undoable edit', async () => {
    const ai = createStubAI()
    ai.reply = req => req.prompt.replace(/^RAJ: /m, '@RAJ\n')
    const collab = createStubCollab()
    const { view } = await mount({ aiProvider: ai, collabBinding: collab })

    fireEvent.click(screen.getByLabelText('Import with AI'))
    fireEvent.change(screen.getByLabelText('…or paste the text'), { target: { value: 'RAJ: Namaste.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(ai.calls).toHaveLength(0)   // nothing sent before the data policy is accepted
    fireEvent.click(screen.getByRole('checkbox'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Format with AI' })) })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Append to document' })).toBeInTheDocument())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Append to document' })) })
    await waitFor(() => expect(doc.text).toBe(TEXT + '\n@RAJ\nNamaste.\n'))

    act(() => { undo(view.state, view.dispatch) })
    await waitFor(() => expect(doc.text).toBe(TEXT))
  })

  it('is not offered without an AI provider or in a read session', async () => {
    const { unmount } = await mount()
    expect(screen.queryByLabelText('Import with AI')).toBeNull()
    unmount()
    await mount({ aiProvider: createStubAI(), session: createSession('read') })
    expect(screen.queryByLabelText('Import with AI')).toBeNull()
  })
})
