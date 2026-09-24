import React from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AppShell } from '../../src/shell/AppShell'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'
import type { DocumentProviderProps } from '../../src/context/DocumentContext'
import { LanguageProvider } from '../../src/i18n/LanguageContext'
import { TranslationProvider } from '../../src/i18n/useTranslation'
import { createRegistries } from '../../src/extensions/registries'
import { matchesShortcut } from '../../src/extensions/command-registry'
import { getEditorView } from '../../src/editor/editor-bus'

const TEXT = '## INT. HOUSE - DAY {#1}\n\nMeera waits.\n\n## EXT. PARK - NIGHT {#2}\n\nRain.\n'

let doc!: ReturnType<typeof useDocument>
function Probe() {
  doc = useDocument()
  React.useEffect(() => { doc.setText(TEXT) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function mount(props: Partial<DocumentProviderProps>) {
  return render(
    <TranslationProvider>
      <DocumentProvider {...(props as DocumentProviderProps)}>
        <LanguageProvider>
          <Probe />
          <AppShell />
        </LanguageProvider>
      </DocumentProvider>
    </TranslationProvider>,
  )
}

describe('matchesShortcut', () => {
  const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)
  it('matches modifiers exactly and keys by code', () => {
    expect(matchesShortcut('Alt-Shift-H', key({ code: 'KeyH', altKey: true, shiftKey: true }))).toBe(true)
    expect(matchesShortcut('Alt+Shift+H', key({ code: 'KeyH', altKey: true, shiftKey: true }))).toBe(true)
    expect(matchesShortcut('Alt-Shift-H', key({ code: 'KeyH', altKey: true }))).toBe(false)
    expect(matchesShortcut('Mod-K', key({ code: 'KeyK', ctrlKey: true }))).toBe(true)
    expect(matchesShortcut('Mod-K', key({ code: 'KeyK', ctrlKey: true, shiftKey: true }))).toBe(false)
    expect(matchesShortcut('Mod-1', key({ code: 'Digit1', ctrlKey: true }))).toBe(true)
  })
})

describe('PanelRegistry', () => {
  it('sidebar panels become tabs beside the navigator; inspector and appbar panels render', async () => {
    const r = createRegistries()
    r.panels.register({ id: 'notes', title: 'Notes', location: 'sidebar', render: ctx => <p>Scenes: {ctx.sceneIds.join(',')}</p> })
    r.panels.register({ id: 'info', title: 'Scene info', location: 'inspector', render: ctx => <p>Active: {ctx.activeSceneId ?? 'none'}</p> })
    r.panels.register({ id: 'badge', title: 'Badge', location: 'appbar', render: () => <span>BADGE</span> })
    await act(async () => { mount({ panels: r.panels }) })

    expect(screen.getByRole('tab', { name: 'Scenes' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(screen.getByRole('tabpanel', { name: 'Notes' })).toHaveTextContent('Scenes: 1,2')
    expect(screen.getByText('BADGE')).toBeInTheDocument()

    // activeSceneId follows the caret
    const view = getEditorView()!
    let rainPos = -1
    view.state.doc.descendants((n, pos) => { if (n.isText && n.text === 'Rain.') rainPos = pos })
    await act(async () => {
      const { TextSelection } = await import('prosemirror-state')
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, rainPos + 1)))
    })
    expect(screen.getByRole('region', { name: 'Scene info' })).toHaveTextContent('Active: 2')
  })

  it('the default layout is unchanged without sidebar panels', async () => {
    await act(async () => { mount({}) })
    expect(screen.queryByRole('tablist', { name: 'Sidebar' })).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Scene Navigator' })).toBeInTheDocument()
    expect(document.querySelector('.cs-inspector')).toBeNull()
  })
})

describe('CommandRegistry', () => {
  it('toolbar and app-bar commands render and run; shortcuts dispatch; unregister removes them', async () => {
    const r = createRegistries()
    const run = vi.fn()
    const off = r.commands.register({ id: 'ext.stamp', label: 'Stamp', menu: 'appbar', shortcut: 'Mod-Shift-K', run })
    r.commands.register({ id: 'ext.tool', label: 'Tool', menu: 'toolbar', run: ctx => ctx.setText(ctx.text + '\nTOOL\n') })
    await act(async () => { mount({ commands: r.commands }) })

    fireEvent.click(screen.getByRole('button', { name: 'Stamp' }))
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0]![0]).toMatchObject({ mode: 'formatted', text: TEXT })

    await act(async () => { fireEvent.keyDown(window, { code: 'KeyK', ctrlKey: true, shiftKey: true }) })
    expect(run).toHaveBeenCalledTimes(2)

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tool' })) })
    await waitFor(() => expect(doc.text).toContain('TOOL'))

    act(() => off())
    expect(screen.queryByRole('button', { name: 'Stamp' })).toBeNull()
  })

  it('built-in element shortcuts still work through the registry', async () => {
    await act(async () => { mount({}) })
    const view = getEditorView()!
    let rainPos = -1
    view.state.doc.descendants((n, pos) => { if (n.isText && n.text === 'Rain.') rainPos = pos })
    const { TextSelection } = await import('prosemirror-state')
    act(() => { view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, rainPos + 1))) })
    await act(async () => { fireEvent.keyDown(window, { code: 'KeyC', altKey: true, shiftKey: true }) })
    expect(view.state.selection.$from.parent.type.name).toBe('character')
  })

  it('read sessions hide editing commands and keep readOnly ones', async () => {
    const r = createRegistries()
    r.commands.register({ id: 'ext.edit', label: 'EditThing', menu: 'appbar', run: vi.fn() })
    r.commands.register({ id: 'ext.view', label: 'ViewThing', menu: 'appbar', readOnly: true, run: vi.fn() })
    await act(async () => {
      mount({ commands: r.commands, session: { userId: null, displayName: null, permission: 'read', featureFlags: {} } })
    })
    expect(screen.queryByRole('button', { name: 'EditThing' })).toBeNull()
    expect(screen.getByRole('button', { name: 'ViewThing' })).toBeInTheDocument()
  })
})

describe('ExportRegistry', () => {
  it('the dialog lists built-ins and registered exporters from one list, and runs them', async () => {
    const r = createRegistries()
    const blob = new Blob(['x'])
    const run = vi.fn(async () => blob)
    r.exporters.register({
      id: 'ext.final-draft', label: 'Final Draft (.fdx)', group: 'screenplay', description: 'For FD users',
      run, fileName: ctx => `${ctx.baseName}.fdx`,
    })
    r.exporters.register({
      id: 'ext.props', label: 'Props list', group: 'report', family: 'Props', formatLabel: 'CSV',
      run: vi.fn(async () => new Blob(['p'])), fileName: () => 'props.csv',
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await act(async () => { mount({ exporters: r.exporters }) })
    await act(async () => { doc.setExportVisible(true) })

    const cards = screen.getAllByRole('radio').map(el => el.textContent)
    expect(cards.some(c => c?.includes('PDF / Print Preview'))).toBe(true)
    expect(cards.some(c => c?.includes('Microsoft Word (.docx)'))).toBe(true)
    expect(cards.some(c => c?.includes('Final Draft (.fdx)'))).toBe(true)

    fireEvent.click(screen.getByText('Final Draft (.fdx)'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Download' })) })
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ text: TEXT, baseName: 'screenplay' }))
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement
    expect(anchor.download).toBe('screenplay.fdx')

    fireEvent.click(screen.getByRole('tab', { name: 'Production Reports' }))
    expect(screen.getByText('Props')).toBeInTheDocument()
    expect(screen.getByText('One-Liner Schedule')).toBeInTheDocument()
    click.mockRestore()
  })
})
