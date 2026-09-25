import React from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AppShell } from '../../src/shell/AppShell'
import { SceneNavigator } from '../../src/navigator/SceneNavigator'
import { SettingsDialog } from '../../src/settings/SettingsDialog'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'
import type { DocumentProviderProps } from '../../src/context/DocumentContext'
import { LanguageProvider } from '../../src/i18n/LanguageContext'
import { TranslationProvider } from '../../src/i18n/useTranslation'
import { getEditorView } from '../../src/editor/editor-bus'
import { createPanelRegistry } from '../../src/extensions/panel-registry'
import { SCENE_METADATA_PROMPT } from '../../src/ai/prompts'
import { stubAIProvider, stubSpeechProvider } from '../helpers/stub-providers'
import type { StorageAdapter } from '../../src/extensions/storage-adapter'

const TEXT = '## INT. HOUSE - DAY {#1}\n\nAction.\n\n## EXT. PARK - NIGHT {#2}\n\nMore action.\n'

function stubStorage(): StorageAdapter {
  return {
    saveDocument: vi.fn(async () => {}),
    loadDocument: vi.fn(async () => null),
    listVersions: vi.fn(async () => []),
    openFile: vi.fn(async () => null),
    openDocx: vi.fn(async () => null),
    openStyleJson: vi.fn(async () => null),
    saveFile: vi.fn(async () => ({ savedName: 'x.sutra', handle: null })),
    saveStyle: vi.fn(async () => {}),
    loadAllStyles: vi.fn(async () => []),
    deleteStyle: vi.fn(async () => {}),
  }
}

let currentText = ''
function Probe({ text }: { text: string }) {
  const { setText, text: live } = useDocument()
  currentText = live
  React.useEffect(() => { setText(text) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function mount(ui: React.ReactNode, props: Partial<DocumentProviderProps> = {}, text = TEXT) {
  return render(
    <TranslationProvider>
      <DocumentProvider storageAdapter={props.storageAdapter ?? stubStorage()} {...props}>
        <LanguageProvider>
          <Probe text={text} />
          {ui}
        </LanguageProvider>
      </DocumentProvider>
    </TranslationProvider>,
  )
}

const GENERATE_ALL = 'Generate synopsis & estimate duration (all scenes)'

describe('AIProvider / SpeechProvider injection', () => {
  it('hides every AI and voice entry point without providers', async () => {
    await act(async () => { mount(<AppShell />) })
    expect(screen.queryByLabelText('Voice Dictation')).toBeNull()
    expect(screen.queryByLabelText(GENERATE_ALL)).toBeNull()
    expect(screen.queryAllByLabelText('Generate synopsis & estimate duration')).toHaveLength(0)
  })

  it('shows AI actions with a provider, and voice only with both providers', async () => {
    const { unmount } = await act(async () => mount(<AppShell />, { aiProvider: stubAIProvider() }))
    expect(screen.getByLabelText(GENERATE_ALL)).toBeInTheDocument()
    expect(screen.queryByLabelText('Voice Dictation')).toBeNull()   // speech missing
    unmount()

    await act(async () => { mount(<AppShell />, { aiProvider: stubAIProvider(), speechProvider: stubSpeechProvider() }) })
    expect(screen.getByLabelText('Voice Dictation')).toBeInTheDocument()
  })

  it('featureFlags turn AI and voice off', async () => {
    await act(async () => {
      mount(<AppShell />, {
        aiProvider: stubAIProvider(),
        speechProvider: stubSpeechProvider(),
        session: { userId: 'u', displayName: 'U', permission: 'edit', featureFlags: { ai: false } },
      })
    })
    expect(screen.queryByLabelText(GENERATE_ALL)).toBeNull()
    expect(screen.queryByLabelText('Voice Dictation')).toBeNull()   // voice needs AI
  })

  it('synopsis generation calls the injected provider and writes the result', async () => {
    const ai = stubAIProvider()
    await act(async () => { mount(<SceneNavigator />, { aiProvider: ai }) })
    await act(async () => {
      fireEvent.click(screen.getAllByLabelText('Generate synopsis & estimate duration')[0]!)
    })
    await waitFor(() => expect(currentText).toContain('& synopsis: Stub synopsis.'))
    expect(ai.completeStructured).toHaveBeenCalledTimes(1)
    const req = ai.completeStructured.mock.calls[0]![0] as { system: string; prompt: string }
    expect(req.system).toBe(SCENE_METADATA_PROMPT)
    expect(req.prompt).toContain('## INT. HOUSE - DAY')
    expect(req.prompt).not.toContain('EXT. PARK')
    expect(currentText).toContain('& est-duration: 01:00')
  })

  it('opens the provider setup instead of calling it when not configured', async () => {
    const ai = stubAIProvider({ isConfigured: vi.fn(async () => false) })
    await act(async () => { mount(<SceneNavigator />, { aiProvider: ai }) })
    await act(async () => { fireEvent.click(screen.getByLabelText(GENERATE_ALL)) })
    await waitFor(() => expect(ai.openSetup).toHaveBeenCalled())
    expect(ai.completeStructured).not.toHaveBeenCalled()
  })
})

describe('SessionContext permissions', () => {
  const READ = { userId: 'r', displayName: 'Reader', permission: 'read' as const, featureFlags: {} }

  const GATED = ['Save', 'Open .sutra', 'New file', 'Voice Dictation', GENERATE_ALL, 'Renumber scenes']

  it('edit (control): the gated actions are present', async () => {
    await act(async () => {
      mount(<AppShell />, { aiProvider: stubAIProvider(), speechProvider: stubSpeechProvider() })
    })
    for (const label of GATED) expect(screen.getAllByLabelText(label).length).toBeGreaterThan(0)
    expect(document.querySelector('.cs-element-toolbar')).not.toBeNull()
    expect(document.querySelector('.ProseMirror')!.getAttribute('contenteditable')).toBe('true')
  })

  it('read: no file, toolbar, AI or voice actions; editor not editable', async () => {
    await act(async () => {
      mount(<AppShell />, { session: READ, aiProvider: stubAIProvider(), speechProvider: stubSpeechProvider() })
    })
    for (const label of GATED) expect(screen.queryByLabelText(label)).toBeNull()
    expect(document.querySelector('.cs-element-toolbar')).toBeNull()
    expect(document.querySelector('.ProseMirror')!.getAttribute('contenteditable')).toBe('false')
    expect(screen.getByLabelText('Export')).toBeInTheDocument()   // reading/exporting still works
  })

  it('read: programmatic document changes through the editor are dropped', async () => {
    await act(async () => { mount(<AppShell />, { session: READ }) })
    const view = getEditorView()!
    const before = view.state.doc.toJSON()
    act(() => { view.dispatch(view.state.tr.insertText('X', 1)) })
    expect(view.state.doc.toJSON()).toEqual(before)
    expect(currentText).toBe(TEXT)
  })

  it('read: Ctrl+S does not save; edit: it does', async () => {
    const storage = stubStorage()
    const { unmount } = await act(async () => mount(<AppShell />, { session: READ, storageAdapter: storage }))
    await act(async () => { fireEvent.keyDown(window, { code: 'KeyS', ctrlKey: true }) })
    expect(storage.saveFile).not.toHaveBeenCalled()
    unmount()

    await act(async () => { mount(<AppShell />, { storageAdapter: storage }) })
    await act(async () => { fireEvent.keyDown(window, { code: 'KeyS', ctrlKey: true }) })
    await waitFor(() => expect(storage.saveFile).toHaveBeenCalled())
  })

  it('comment behaves like read for editing', async () => {
    await act(async () => { mount(<AppShell />, { session: { ...READ, permission: 'comment' } }) })
    expect(screen.queryByLabelText('Save')).toBeNull()
    expect(document.querySelector('.ProseMirror')!.getAttribute('contenteditable')).toBe('false')
  })
})

describe('settings panels', () => {
  it('renders embedder sections, including ones registered at runtime', async () => {
    const registry = createPanelRegistry([
      { id: 'ai', title: 'Intelligence & Voice', location: 'settings', render: () => <p>AI settings body</p> },
    ])
    await act(async () => { mount(<SettingsDialog onClose={() => {}} />, { panels: registry }) })
    expect(screen.getByRole('region', { name: 'Intelligence & Voice' })).toHaveTextContent('AI settings body')

    let off!: () => void
    act(() => {
      off = registry.register({ id: 'extra', title: 'Extra', location: 'settings', render: () => <p>More</p> })
    })
    expect(screen.getByText('More')).toBeInTheDocument()
    act(() => off())
    expect(screen.queryByText('More')).toBeNull()
  })
})
