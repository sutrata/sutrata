import React from 'react'
import { render, act, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { AppShell } from '../../src/shell/AppShell'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'
import { LanguageProvider } from '../../src/i18n/LanguageContext'
import { TranslationProvider } from '../../src/i18n/useTranslation'
import type { StorageAdapter } from '../../src/extensions/storage-adapter'
import type { SessionContext } from '../../src/extensions/session'

let ctx: ReturnType<typeof useDocument>
function Probe() {
  ctx = useDocument()
  return null
}

function storage(extra: Partial<StorageAdapter> = {}): StorageAdapter {
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
    ...extra,
  }
}

async function mount(adapter: StorageAdapter, session?: SessionContext) {
  await act(async () => {
    render(
      <TranslationProvider>
        <DocumentProvider storageAdapter={adapter} session={session}>
          <LanguageProvider>
            <Probe />
            <AppShell />
          </LanguageProvider>
        </DocumentProvider>
      </TranslationProvider>,
    )
  })
}

const cloudSession: SessionContext = { userId: 'u', displayName: 'U', permission: 'edit', featureFlags: { localFiles: false } }

describe('embedders whose documents are not local files', () => {
  it('featureFlags.localFiles false hides New, Open and Save As; Save stays', async () => {
    await mount(storage(), cloudSession)
    expect(screen.queryAllByLabelText('New file')).toHaveLength(0)
    expect(screen.queryAllByLabelText('Open .sutra')).toHaveLength(0)
    expect(screen.queryAllByLabelText('Save As')).toHaveLength(0)
    expect(screen.getAllByLabelText('Save').length).toBeGreaterThan(0)
  })

  it('and Ctrl+O / Save As do nothing', async () => {
    const adapter = storage()
    await mount(adapter, cloudSession)
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO', ctrlKey: true })) })
    await act(async () => { await ctx.saveFileAs() })
    expect(adapter.openFile).not.toHaveBeenCalled()
    expect(adapter.saveFile).not.toHaveBeenCalled()
  })

  it('by default the file actions are there', async () => {
    await mount(storage())
    expect(screen.getAllByLabelText('New file').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Open .sutra').length).toBeGreaterThan(0)
  })

  it('no local-session recovery: the pointer is neither read nor written', async () => {
    const pointer = JSON.stringify({ path: 'other-doc', updatedAt: 1 })
    localStorage.setItem('sutrata:recovery-pointer', pointer)
    const adapter = storage({ loadDocument: vi.fn().mockResolvedValue('## OTHER\n') })
    await mount(adapter, cloudSession)
    expect(adapter.loadDocument).not.toHaveBeenCalled()
    await act(async () => { ctx.setFilePath('doc-1'); ctx.setText('## MINE\n') })
    await act(async () => { await ctx.save() })
    expect(localStorage.getItem('sutrata:recovery-pointer')).toBe(pointer)
    localStorage.removeItem('sutrata:recovery-pointer')
  })

  it('the file pill shows the adapter display name for the path', async () => {
    await mount(storage({ displayName: path => (path === 'doc-7f3a' ? 'கடைசி ரயில்' : path) }), cloudSession)
    await act(async () => { ctx.setFilePath('doc-7f3a') })
    const pill = document.querySelector('.cs-ab-file-pill')!
    expect(pill.textContent).toContain('கடைசி ரயில்')
    expect(pill.textContent).not.toContain('doc-7f3a')
  })
})
