import React from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
import { undo } from 'prosemirror-history'
import { parse } from '@sutrata/parser'
import { AppShell } from '../../src/shell/AppShell'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'
import { LanguageProvider } from '../../src/i18n/LanguageContext'
import { TranslationProvider } from '../../src/i18n/useTranslation'
import { getEditorView } from '../../src/editor/editor-bus'
import { exportToDocx } from '../../src/file/docx-exporter'
import { openScreenplayPrintPreview } from '../../src/file/workflow-reports'

let doc!: ReturnType<typeof useDocument>
function Probe({ text }: { text: string }) {
  doc = useDocument()
  React.useEffect(() => { doc.setText(text) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

async function mount(text: string) {
  return act(async () => render(
    <TranslationProvider>
      <DocumentProvider>
        <LanguageProvider>
          <Probe text={text} />
          <AppShell />
        </LanguageProvider>
      </DocumentProvider>
    </TranslationProvider>,
  ))
}

const scene = (heading: string, number?: string) =>
  `## ${heading}${number ? `\n& number: ${number}` : ''}\n\n${heading} action.\n`
const NUMBERED = [scene('INT. A {#a}', '12'), scene('INT. NEW {#n}'), scene('INT. B {#b}', '13'), scene('INT. COPY {#c}', '13')].join('\n')

function navItems(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.cs-nav-item')).map(el => ({
    num: el.querySelector('.cs-nav-scene-num')?.textContent ?? null,
    issue: el.classList.contains('cs-nav-scene-number-issue'),
    title: el.querySelector('.cs-nav-num-issue')?.getAttribute('title') ?? null,
  }))
}

describe('navigator: scene numbers (format spec §7.4)', () => {
  it('flags missing and duplicate numbers, with a reason', async () => {
    const { container } = await mount(NUMBERED)
    expect(navItems(container)).toEqual([
      { num: '12', issue: false, title: null },
      { num: '#?', issue: true, title: 'No scene number yet — renumber to assign one' },
      { num: '13', issue: false, title: null },
      { num: '13', issue: true, title: 'Duplicate scene number — renumber to fix' },
    ])
  })

  it('flags nothing in a script that was never numbered', async () => {
    const { container } = await mount(scene('INT. A') + '\n' + scene('INT. B'))
    expect(container.querySelectorAll('.cs-nav-scene-number-issue')).toHaveLength(0)
  })

  it('Renumber scenes fixes them as one undoable edit', async () => {
    const { container } = await mount(NUMBERED)
    await act(async () => { fireEvent.click(screen.getByLabelText('Renumber scenes')) })
    await waitFor(() => expect(navItems(container).map(i => i.num)).toEqual(['12', '13', '14', '15']))
    expect(container.querySelectorAll('.cs-nav-scene-number-issue')).toHaveLength(0)
    expect(doc.text).toContain('## INT. B {#b}\n& number: 14')

    const view = getEditorView()!
    act(() => { undo(view.state, view.dispatch) })
    await waitFor(() => expect(navItems(container).map(i => i.num)).toEqual(['12', '#?', '13', '13']))
  })

  it('Omit scene keeps heading and number, hides the body in a comment, and Restore brings it back', async () => {
    const { container } = await mount(NUMBERED)
    await act(async () => { fireEvent.click(screen.getByLabelText('Omit scene: INT. B')) })
    await waitFor(() => expect(doc.text).toContain('## INT. B {#b}\n& number: 13\n& status: omitted\n\n<!-- INT. B {#b} action. -->'))
    expect(container.querySelector('.cs-nav-scene-omitted .cs-nav-heading')?.textContent).toBe('INT. B')
    expect(container.querySelector('.cs-scene-omitted .cs-omitted-badge')?.textContent).toBe('OMITTED')

    await act(async () => { fireEvent.click(screen.getByLabelText('Restore omitted scene: INT. B')) })
    await waitFor(() => expect(doc.text).toBe(NUMBERED))
    expect(container.querySelector('.cs-omitted-badge')).toBeNull()
  })
})

describe('exports: scene number and OMITTED', () => {
  const TEXT = '## INT. A {#a}\n& number: 12\n\nAction.\n\n## INT. B {#b}\n& number: 13\n& status: omitted\n\n<!-- gone -->\n\n## INT. C {#c}\n\nC.\n'

  it('DOCX prints & number: (else the id) and OMITTED', async () => {
    const zip = await JSZip.loadAsync(await (await exportToDocx(parse(TEXT))).arrayBuffer())
    const xml = await zip.file('word/document.xml')!.async('text')
    const texts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1])
    expect(texts).toContain('12')
    expect(texts).toContain('OMITTED')
    expect(texts).toContain('13')
    expect(texts).toContain('c')
    expect(texts).not.toContain('INT. B')
  })

  it('PDF/print prints & number: and OMITTED', async () => {
    const originalOpen = window.open
    let written = ''
    window.open = () => ({ document: { write: (html: string) => { written = html }, close: () => {} } } as any)
    try {
      await openScreenplayPrintPreview(parse(TEXT))
    } finally {
      window.open = originalOpen
    }
    expect(written).toContain('<span class="print-scene-num">12</span>')
    expect(written).toMatch(/<span class="print-scene-title">OMITTED<\/span>\s*<span class="print-scene-num">13<\/span>/)
    expect(written).not.toContain('INT. B')
  })
})
