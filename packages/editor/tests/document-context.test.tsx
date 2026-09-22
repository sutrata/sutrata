import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { DocumentProvider, useDocument } from '../src/context/DocumentContext'
import type { StorageAdapter } from '../src/extensions/storage-adapter'

// Must match RECOVERY_POINTER_KEY in ../src/context/DocumentContext.tsx.
const RECOVERY_POINTER_KEY = 'sutrata:recovery-pointer'

function makeMockStorageAdapter(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return {
    saveDocument: vi.fn().mockResolvedValue(undefined),
    loadDocument: vi.fn().mockResolvedValue(null),
    listVersions: vi.fn().mockResolvedValue([]),
    openFile: vi.fn().mockResolvedValue(null),
    openDocx: vi.fn().mockResolvedValue(null),
    openStyleJson: vi.fn().mockResolvedValue(null),
    saveFile: vi.fn().mockResolvedValue(null),
    saveStyle: vi.fn().mockResolvedValue(undefined),
    loadAllStyles: vi.fn().mockResolvedValue([]),
    deleteStyle: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const mockStorageAdapter = makeMockStorageAdapter()

function Probe() {
  const { ribbonVisible, setRibbonVisible, navVisible } = useDocument()
  return (
    <div>
      <span data-testid="ribbon">{String(ribbonVisible)}</span>
      <span data-testid="nav">{String(navVisible)}</span>
      <button onClick={() => setRibbonVisible(!ribbonVisible)}>toggle</button>
    </div>
  )
}

describe('DocumentContext visibility flags', () => {
  it('defaults ribbon visible and nav visible on desktop (jsdom innerWidth=1024)', () => {
    render(<DocumentProvider storageAdapter={mockStorageAdapter}><Probe /></DocumentProvider>)
    expect(screen.getByTestId('ribbon').textContent).toBe('true')
    expect(screen.getByTestId('nav').textContent).toBe('true')
  })

  it('toggles ribbon visibility', () => {
    render(<DocumentProvider storageAdapter={mockStorageAdapter}><Probe /></DocumentProvider>)
    fireEvent.click(screen.getByText('toggle'))
    expect(screen.getByTestId('ribbon').textContent).toBe('false')
  })

  it('Ctrl-S calls preventDefault and saves', () => {
    render(<DocumentProvider storageAdapter={mockStorageAdapter}><Probe /></DocumentProvider>)
    const ev = new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, cancelable: true })
    const prevent = vi.spyOn(ev, 'preventDefault')
    act(() => { window.dispatchEvent(ev) })
    expect(prevent).toHaveBeenCalled()
  })
})

function FullProbe() {
  const {
    text, isDirty, filePath, lastSaveTarget, setText, newDocument, openFile, saveFile, saveFileAs, save,
    confirmModal, toasts, versions, restoreVersion, clearVersionHistory,
  } = useDocument()
  return (
    <div>
      <span data-testid="text">{text}</span>
      <span data-testid="dirty">{String(isDirty)}</span>
      <span data-testid="filePath">{String(filePath)}</span>
      <span data-testid="lastSaveTarget">{String(lastSaveTarget)}</span>
      <span data-testid="toasts">{toasts.map(t => t.message).join('|')}</span>
      <span data-testid="confirm-title">{confirmModal?.title ?? ''}</span>
      <span data-testid="versions">{versions.map(v => v.id).join('|')}</span>
      <button onClick={() => setText('## Scene 1\n\nEdited by the user.\n')}>edit</button>
      <button onClick={() => newDocument()}>new</button>
      <button onClick={() => void openFile()}>open</button>
      <button onClick={() => void saveFile()}>save</button>
      <button onClick={() => void saveFileAs()}>saveAs</button>
      <button onClick={() => void save()}>autosaveNow</button>
      <button onClick={() => confirmModal?.onConfirm()}>confirm</button>
      <button onClick={() => confirmModal?.onCancel?.()}>cancel</button>
      <button onClick={() => versions[1] && restoreVersion(versions[1])}>restoreSecond</button>
      <button onClick={() => void clearVersionHistory()}>clearVersions</button>
    </div>
  )
}

describe('DocumentContext reload recovery (Ctrl-R data loss fix)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts blank when there is no recovery pointer', () => {
    const adapter = makeMockStorageAdapter()
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)
    expect(adapter.loadDocument).not.toHaveBeenCalled()
    expect(screen.getByTestId('dirty').textContent).toBe('false')
  })

  it('restores autosaved content left behind by a previous session, marks it dirty, and toasts', async () => {
    localStorage.setItem(RECOVERY_POINTER_KEY, JSON.stringify({ path: '__autosave__', updatedAt: Date.now() }))
    const adapter = makeMockStorageAdapter({
      loadDocument: vi.fn().mockResolvedValue('## Scene 1\n\nRECOVERED CONTENT.\n'),
    })

    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('text').textContent).toContain('RECOVERED CONTENT')
    })
    expect(screen.getByTestId('dirty').textContent).toBe('true')
    expect(screen.getByTestId('filePath').textContent).toBe('null')
    expect(screen.getByTestId('toasts').textContent).toContain('Recovered unsaved changes')
  })

  it('restores under the real filePath when the pointer names one', async () => {
    localStorage.setItem(RECOVERY_POINTER_KEY, JSON.stringify({ path: 'myscript.sutra', updatedAt: Date.now() }))
    const adapter = makeMockStorageAdapter({
      loadDocument: vi.fn().mockResolvedValue('## Scene 1\n\nRecovered named file.\n'),
    })

    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('filePath').textContent).toBe('myscript.sutra')
    })
    expect(adapter.loadDocument).toHaveBeenCalledWith('myscript.sutra')
  })

  it('openFile asks for confirmation instead of silently discarding unsaved edits', async () => {
    const adapter = makeMockStorageAdapter()
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    fireEvent.click(screen.getByText('edit'))
    expect(screen.getByTestId('dirty').textContent).toBe('true')

    fireEvent.click(screen.getByText('open'))
    expect(screen.getByTestId('confirm-title').textContent).toBe('Discard Unsaved Changes?')
    expect(adapter.openFile).not.toHaveBeenCalled()

    await act(async () => { fireEvent.click(screen.getByText('confirm')) })
    expect(adapter.openFile).toHaveBeenCalled()
  })

  it('openFile proceeds without a prompt when there is nothing unsaved', () => {
    const adapter = makeMockStorageAdapter()
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)
    fireEvent.click(screen.getByText('open'))
    expect(adapter.openFile).toHaveBeenCalled()
    expect(screen.getByTestId('confirm-title').textContent).toBe('')
  })

  it('saveFile clears the recovery pointer since content is now safely on disk', async () => {
    localStorage.setItem(RECOVERY_POINTER_KEY, JSON.stringify({ path: '__autosave__', updatedAt: Date.now() }))
    const adapter = makeMockStorageAdapter({
      saveFile: vi.fn().mockResolvedValue({ savedName: 'myscript.sutra', handle: null }),
    })
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    await act(async () => { fireEvent.click(screen.getByText('save')) })

    expect(localStorage.getItem(RECOVERY_POINTER_KEY)).toBeNull()
  })

  it('autosaves at least once every 30s even during continuous, uninterrupted typing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const adapter = makeMockStorageAdapter()
      render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

      fireEvent.click(screen.getByText('edit'))

      // Simulate a keystroke every second for 35s straight — under the old pure-debounce
      // implementation this would reset the 30s timer every time and never fire.
      for (let i = 0; i < 35; i++) {
        await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
        fireEvent.click(screen.getByText('edit'))
      }
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })

      expect(adapter.saveDocument).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('DocumentContext three-state save status (Phase 2)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('marks lastSaveTarget "local" after an autosave, distinct from a real file save', async () => {
    const adapter = makeMockStorageAdapter()
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    fireEvent.click(screen.getByText('edit'))
    await act(async () => { fireEvent.click(screen.getByText('autosaveNow')) })

    expect(screen.getByTestId('lastSaveTarget').textContent).toBe('local')
  })

  it('marks lastSaveTarget "file" after saveFile, overriding a prior local autosave', async () => {
    const adapter = makeMockStorageAdapter({
      saveFile: vi.fn().mockResolvedValue({ savedName: 'myscript.sutra', handle: null }),
    })
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    fireEvent.click(screen.getByText('edit'))
    await act(async () => { fireEvent.click(screen.getByText('autosaveNow')) })
    expect(screen.getByTestId('lastSaveTarget').textContent).toBe('local')

    await act(async () => { fireEvent.click(screen.getByText('save')) })
    expect(screen.getByTestId('lastSaveTarget').textContent).toBe('file')
  })

  it('marks lastSaveTarget "file" after opening a (non-fountain) file, with nothing unsaved yet', async () => {
    const adapter = makeMockStorageAdapter({
      openFile: vi.fn().mockResolvedValue({ name: 'myscript.sutra', content: '## Scene 1\n\nHi.\n', handle: null }),
    })
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    await act(async () => { fireEvent.click(screen.getByText('open')) })

    expect(screen.getByTestId('lastSaveTarget').textContent).toBe('file')
    expect(screen.getByTestId('dirty').textContent).toBe('false')
  })
})

describe('DocumentContext file handle persistence (Phase 2)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists the handle after saveFileAs and after opening a file', async () => {
    const fakeHandle = { name: 'myscript.sutra' }
    const adapter = makeMockStorageAdapter({
      saveFile: vi.fn().mockResolvedValue({ savedName: 'myscript.sutra', handle: fakeHandle }),
      openFile: vi.fn().mockResolvedValue({ name: 'other.sutra', content: '## Scene 1\n\nHi.\n', handle: fakeHandle }),
      persistFileHandle: vi.fn().mockResolvedValue(undefined),
    })
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    await act(async () => { fireEvent.click(screen.getByText('saveAs')) })
    expect(adapter.persistFileHandle).toHaveBeenCalledWith('myscript.sutra', fakeHandle)

    await act(async () => { fireEvent.click(screen.getByText('open')) })
    expect(adapter.persistFileHandle).toHaveBeenCalledWith('other.sutra', fakeHandle)
  })

  it('reattaches a still-permitted handle on boot recovery so the next save writes back in place', async () => {
    localStorage.setItem(RECOVERY_POINTER_KEY, JSON.stringify({ path: 'myscript.sutra', updatedAt: Date.now() }))
    const fakeHandle = { name: 'myscript.sutra' }
    const adapter = makeMockStorageAdapter({
      loadDocument: vi.fn().mockResolvedValue('## Scene 1\n\nRecovered.\n'),
      restoreFileHandle: vi.fn().mockResolvedValue(fakeHandle),
      saveFile: vi.fn().mockResolvedValue({ savedName: 'myscript.sutra', handle: fakeHandle }),
    })

    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('filePath').textContent).toBe('myscript.sutra')
    })
    expect(adapter.restoreFileHandle).toHaveBeenCalledWith('myscript.sutra')

    // Confirms the reattached handle actually reaches saveFile as the existing handle
    // to write back in place, instead of null (which would force a Save As prompt).
    await act(async () => { fireEvent.click(screen.getByText('save')) })
    expect(adapter.saveFile).toHaveBeenCalledWith('myscript.sutra', expect.any(String), fakeHandle)
  })

  it('does not reattach a handle the adapter refuses (permission not granted)', async () => {
    localStorage.setItem(RECOVERY_POINTER_KEY, JSON.stringify({ path: 'myscript.sutra', updatedAt: Date.now() }))
    const adapter = makeMockStorageAdapter({
      loadDocument: vi.fn().mockResolvedValue('## Scene 1\n\nRecovered.\n'),
      restoreFileHandle: vi.fn().mockResolvedValue(null),
      saveFile: vi.fn().mockResolvedValue({ savedName: 'myscript.sutra', handle: null }),
    })

    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('filePath').textContent).toBe('myscript.sutra')
    })

    await act(async () => { fireEvent.click(screen.getByText('save')) })
    expect(adapter.saveFile).toHaveBeenCalledWith('myscript.sutra', expect.any(String), null)
  })
})

describe('DocumentContext desktop window-close guard (Phase 3)', () => {
  afterEach(() => {
    delete (window as { desktopAPI?: unknown }).desktopAPI
  })

  it('closes immediately when there is nothing unsaved', async () => {
    let trigger: (() => void) | undefined
    const closeWindow = vi.fn().mockResolvedValue(undefined)
    window.desktopAPI = {
      readFile: vi.fn(), writeFile: vi.fn(), showOpenDialog: vi.fn(), showSaveDialog: vi.fn(),
      onMenuCommand: vi.fn().mockReturnValue(() => {}),
      onCloseRequested: (cb: () => void) => { trigger = cb; return () => {} },
      closeWindow,
    } as unknown as typeof window.desktopAPI

    const adapter = makeMockStorageAdapter()
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    expect(trigger).toBeDefined()
    await act(async () => { trigger!() })

    expect(closeWindow).toHaveBeenCalled()
  })

  it('asks for confirmation, then saves and closes, when there are unsaved edits', async () => {
    let trigger: (() => void) | undefined
    const closeWindow = vi.fn().mockResolvedValue(undefined)
    const adapter = makeMockStorageAdapter({
      saveFile: vi.fn().mockResolvedValue({ savedName: 'myscript.sutra', handle: null }),
    })
    window.desktopAPI = {
      readFile: vi.fn(), writeFile: vi.fn(), showOpenDialog: vi.fn(), showSaveDialog: vi.fn(),
      onMenuCommand: vi.fn().mockReturnValue(() => {}),
      onCloseRequested: (cb: () => void) => { trigger = cb; return () => {} },
      closeWindow,
    } as unknown as typeof window.desktopAPI

    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    fireEvent.click(screen.getByText('edit'))
    act(() => { trigger!() })

    expect(screen.getByTestId('confirm-title').textContent).toBe('Unsaved Changes')
    expect(closeWindow).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('confirm'))
    // saveFile()'s internal await plus its .then() are both microtasks; a real
    // macrotask boundary is enough to flush them without fake timers.
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })

    expect(adapter.saveFile).toHaveBeenCalled()
    expect(closeWindow).toHaveBeenCalled()
  })

  it('stays open if the save during close is cancelled (no handle returned)', async () => {
    let trigger: (() => void) | undefined
    const closeWindow = vi.fn().mockResolvedValue(undefined)
    const adapter = makeMockStorageAdapter({
      saveFile: vi.fn().mockResolvedValue(null), // user dismissed the Save As picker
    })
    window.desktopAPI = {
      readFile: vi.fn(), writeFile: vi.fn(), showOpenDialog: vi.fn(), showSaveDialog: vi.fn(),
      onMenuCommand: vi.fn().mockReturnValue(() => {}),
      onCloseRequested: (cb: () => void) => { trigger = cb; return () => {} },
      closeWindow,
    } as unknown as typeof window.desktopAPI

    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    fireEvent.click(screen.getByText('edit'))
    act(() => { trigger!() })
    fireEvent.click(screen.getByText('confirm'))
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })

    expect(adapter.saveFile).toHaveBeenCalled()
    expect(closeWindow).not.toHaveBeenCalled()
  })
})

describe('DocumentContext version history (power-user feature)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads versions for the file once it has a filePath', async () => {
    const versionList = [
      { id: 'v2', timestamp: 200, content: '## Scene 1\n\nSecond save.\n' },
      { id: 'v1', timestamp: 100, content: '## Scene 1\n\nFirst save.\n' },
    ]
    const adapter = makeMockStorageAdapter({
      openFile: vi.fn().mockResolvedValue({ name: 'myscript.sutra', content: '## Scene 1\n\nHi.\n', handle: null }),
      listVersions: vi.fn().mockResolvedValue(versionList),
    })
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    expect(screen.getByTestId('versions').textContent).toBe('')

    await act(async () => { fireEvent.click(screen.getByText('open')) })

    await waitFor(() => {
      expect(screen.getByTestId('versions').textContent).toBe('v2|v1')
    })
    expect(adapter.listVersions).toHaveBeenCalledWith('myscript.sutra')
  })

  it('refreshes the version list after re-saving the same already-named file', async () => {
    const adapter = makeMockStorageAdapter({
      saveFile: vi.fn().mockResolvedValue({ savedName: 'myscript.sutra', handle: null }),
      listVersions: vi.fn()
        .mockResolvedValueOnce([{ id: 'v1', timestamp: 100, content: 'old' }])
        .mockResolvedValueOnce([
          { id: 'v2', timestamp: 200, content: 'new' },
          { id: 'v1', timestamp: 100, content: 'old' },
        ]),
      openFile: vi.fn().mockResolvedValue({ name: 'myscript.sutra', content: '## Scene 1\n\nHi.\n', handle: null }),
    })
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    await act(async () => { fireEvent.click(screen.getByText('open')) })
    await waitFor(() => {
      expect(screen.getByTestId('versions').textContent).toBe('v1')
    })

    // filePath doesn't change on this save (already 'myscript.sutra'), so the
    // filePath-change effect alone wouldn't refetch — saveFile must do it explicitly.
    fireEvent.click(screen.getByText('edit'))
    await act(async () => { fireEvent.click(screen.getByText('save')) })

    await waitFor(() => {
      expect(screen.getByTestId('versions').textContent).toBe('v2|v1')
    })
  })

  it('creates no version on autosave — only explicit saveFile/saveFileAs does', async () => {
    const adapter = makeMockStorageAdapter({
      saveFile: vi.fn().mockResolvedValue({ savedName: 'myscript.sutra', handle: null }),
    })
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    fireEvent.click(screen.getByText('edit'))
    await act(async () => { fireEvent.click(screen.getByText('autosaveNow')) })

    // Autosave goes through storageAdapter.saveDocument, never storageAdapter.saveFile.
    expect(adapter.saveDocument).toHaveBeenCalled()
    expect(adapter.saveFile).not.toHaveBeenCalled()
  })

  it('restoreVersion replaces the document content and marks it dirty', async () => {
    const versionList = [
      { id: 'v2', timestamp: 200, content: '## Scene 1\n\nCurrent.\n' },
      { id: 'v1', timestamp: 100, content: '## Scene 1\n\nOlder version.\n' },
    ]
    const adapter = makeMockStorageAdapter({
      openFile: vi.fn().mockResolvedValue({ name: 'myscript.sutra', content: '## Scene 1\n\nCurrent.\n', handle: null }),
      listVersions: vi.fn().mockResolvedValue(versionList),
    })
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    await act(async () => { fireEvent.click(screen.getByText('open')) })
    await waitFor(() => {
      expect(screen.getByTestId('versions').textContent).toBe('v2|v1')
    })

    fireEvent.click(screen.getByText('restoreSecond'))

    expect(screen.getByTestId('text').textContent).toContain('Older version')
    expect(screen.getByTestId('dirty').textContent).toBe('true')
  })

  it('clearVersionHistory asks for confirmation, then calls the adapter and empties the list', async () => {
    const versionList = [
      { id: 'v1', timestamp: 100, content: '## Scene 1\n\nFirst save.\n' },
    ]
    const adapter = makeMockStorageAdapter({
      openFile: vi.fn().mockResolvedValue({ name: 'myscript.sutra', content: '## Scene 1\n\nHi.\n', handle: null }),
      listVersions: vi.fn().mockResolvedValue(versionList),
      deleteAllVersions: vi.fn().mockResolvedValue(undefined),
    })
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    await act(async () => { fireEvent.click(screen.getByText('open')) })
    await waitFor(() => {
      expect(screen.getByTestId('versions').textContent).toBe('v1')
    })

    fireEvent.click(screen.getByText('clearVersions'))
    expect(screen.getByTestId('confirm-title').textContent).toBe('Delete Version History?')
    expect(adapter.deleteAllVersions).not.toHaveBeenCalled()

    await act(async () => { fireEvent.click(screen.getByText('confirm')) })

    expect(adapter.deleteAllVersions).toHaveBeenCalledWith('myscript.sutra')
    expect(screen.getByTestId('versions').textContent).toBe('')
  })

  it('newDocument resets filePath and versions so new file is not tracked under old file history', async () => {
    const versionList = [
      { id: 'v1', timestamp: 100, content: '## Scene 1\n\nFirst save.\n' },
    ]
    const adapter = makeMockStorageAdapter({
      openFile: vi.fn().mockResolvedValue({ name: 'myscript.sutra', content: '## Scene 1\n\nHi.\n', handle: null }),
      listVersions: vi.fn().mockResolvedValue(versionList),
      saveDocument: vi.fn().mockResolvedValue(undefined),
    })
    render(<DocumentProvider storageAdapter={adapter}><FullProbe /></DocumentProvider>)

    // Open existing file with versions
    await act(async () => { fireEvent.click(screen.getByText('open')) })
    await waitFor(() => {
      expect(screen.getByTestId('filePath').textContent).toBe('myscript.sutra')
      expect(screen.getByTestId('versions').textContent).toBe('v1')
    })

    // Start a new document
    act(() => { fireEvent.click(screen.getByText('new')) })

    // filePath and versions must be cleared immediately
    expect(screen.getByTestId('filePath').textContent).toBe('null')
    expect(screen.getByTestId('versions').textContent).toBe('')
    expect(screen.getByTestId('dirty').textContent).toBe('false')

    // An edit to the new document and subsequent autosave must NOT write to 'myscript.sutra'
    fireEvent.click(screen.getByText('edit'))
    await act(async () => { fireEvent.click(screen.getByText('autosaveNow')) })
    expect(adapter.saveDocument).toHaveBeenCalledWith('__autosave__', expect.any(String))
    expect(adapter.saveDocument).not.toHaveBeenCalledWith('myscript.sutra', expect.any(String))
  })
})
