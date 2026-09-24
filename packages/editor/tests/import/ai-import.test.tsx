import React from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import JSZip from 'jszip'
import { parse } from '@sutrata/parser'
import {
  chunkSource, contentWords, compareContent, formatChunk, runAiImport,
  splitBlocks, blockKind, retypeBlock, cleanImportOutput,
} from '../../src/import/ai-import'
import { readDocxText, isSutrataDocx } from '../../src/file/docx-importer'
import { exportToDocx } from '../../src/file/docx-exporter'
import { AIImportDialog } from '../../src/import/AIImportDialog'
import { DocumentProvider, useDocument } from '../../src/context/DocumentContext'
import { TranslationProvider } from '../../src/i18n/useTranslation'
import { stubAIProvider } from '../helpers/stub-providers'
import type { AIProvider } from '../../src/extensions/ai-provider'

/** A formatter that turns "NAME:" lines into cues and keeps everything else — faithful by construction. */
const faithful = async ({ prompt }: { prompt: string }) =>
  prompt.split('\n\n').map(p => p.replace(/^([A-Z]+):\s*/, '@$1\n')).join('\n\n')

describe('chunkSource', () => {
  const para = (n: number) => `Paragraph ${n} ` + 'words '.repeat(20)
  it('groups paragraphs under the size budget without losing any', () => {
    const text = Array.from({ length: 30 }, (_, i) => para(i)).join('\n\n')
    const chunks = chunkSource(text, 1000)
    expect(chunks.length).toBeGreaterThan(3)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000)
    expect(contentWords(chunks.join('\n\n'))).toEqual(contentWords(text))
  })

  it('prefers to break before a likely scene heading once past half the budget', () => {
    const text = [para(1), para(2), para(3), 'INT. HOUSE - NIGHT', para(4)].join('\n\n')
    const chunks = chunkSource(text, 600)
    expect(chunks.some(c => c.startsWith('INT. HOUSE - NIGHT'))).toBe(true)
  })

  it('splits an oversized paragraph at line boundaries', () => {
    const big = Array.from({ length: 50 }, (_, i) => `line ${i} of the long paragraph`).join('\n')
    const chunks = chunkSource(big, 300)
    expect(chunks.length).toBeGreaterThan(1)
    expect(contentWords(chunks.join('\n'))).toEqual(contentWords(big))
  })
})

describe('content comparison', () => {
  it('ignores sigils, attribute blocks, punctuation and case', () => {
    const src = 'Scene 12\n\nMEERA: Where are you?'
    const out = '## Scene {#x}\n\n@MEERA\nwhere *are* you'
    expect(compareContent(src, out)).toEqual({ dropped: ['12'], added: [] })
  })

  it('treats composed and decomposed Unicode as equal (NFC)', () => {
    expect(compareContent('क़िला', 'क़िला')).toEqual({ dropped: [], added: [] })
  })

  it('reports dropped and added words', () => {
    expect(compareContent('मीरा आती है', 'मीरा जाती है')).toEqual({ dropped: ['आती'], added: ['जाती'] })
  })

  it('cleans code fences and frontmatter from model output', () => {
    expect(cleanImportOutput('```sutra\n## A\n```')).toBe('## A')
    expect(cleanImportOutput('---\ntitle: x\n---\n## A')).toBe('## A')
  })
})

describe('formatChunk', () => {
  it('accepts a faithful result on the first attempt', async () => {
    const ai = stubAIProvider({ complete: vi.fn(faithful) })
    const r = await formatChunk(ai, 'MEERA: हम ट्रेन छूट गए', 0)
    expect(r).toMatchObject({ output: '@MEERA\nहम ट्रेन छूट गए', attempts: 1, problems: [] })
  })

  it('retries once when content is dropped, and keeps the good retry', async () => {
    const complete = vi.fn()
      .mockResolvedValueOnce('@MEERA\nहम छूट गए')
      .mockImplementationOnce(faithful)
    const r = await formatChunk(stubAIProvider({ complete }), 'MEERA: हम ट्रेन छूट गए', 0)
    expect(complete).toHaveBeenCalledTimes(2)
    expect(r.attempts).toBe(2)
    expect(r.problems).toEqual([])
  })

  it('reports the problem when both attempts fail, keeping the closer one', async () => {
    const complete = vi.fn()
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('The train left. Extra words here.')
    const r = await formatChunk(stubAIProvider({ complete }), 'The train left.', 0)
    expect(r.output).toBe('The train left. Extra words here.')
    expect(r.problems.join(' ')).toMatch(/Not in the source \(3\): extra, words, here/)
  })

  it('allows page furniture and page numbers to be dropped', async () => {
    const ai = stubAIProvider({ complete: vi.fn(async () => 'She waits.') })
    expect((await formatChunk(ai, 'She waits.\n\n(CONTINUED)\n\n12.', 0)).problems).toEqual([])
  })
})

describe('runAiImport', () => {
  it('formats every chunk in order and reports progress', async () => {
    const ai = stubAIProvider({ complete: vi.fn(faithful) })
    const text = Array.from({ length: 6 }, (_, i) => `RAJ: line ${i} ` + 'x '.repeat(40)).join('\n\n')
    const progress: [number, number][] = []
    const r = await runAiImport(ai, text, { maxChars: 200, onProgress: (d, t) => progress.push([d, t]) })
    expect(r.chunks.length).toBe(progress.at(-1)![1])
    expect(progress.at(-1)![0]).toBe(r.chunks.length)
    expect(parse(r.sutra).children.filter(n => n.type === 'character')).toHaveLength(6)
  })

  it('stops when aborted', async () => {
    const controller = new AbortController()
    const ai = stubAIProvider({ complete: vi.fn(async () => { controller.abort(); return 'x' }) })
    await expect(runAiImport(ai, 'a\n\n' + 'b '.repeat(4000), { signal: controller.signal, maxChars: 100 }))
      .rejects.toThrow()
    expect(ai.complete).toHaveBeenCalledTimes(1)
  })
})

describe('review helpers', () => {
  it('splits, classifies and retypes blocks without losing words', () => {
    const blocks = splitBlocks('## INT. X\n& synopsis: s\n\nShe waits.\n\n@RAJ\nHi.\n\n<!-- a\n\nb -->')
    expect(blocks.map(blockKind)).toEqual(['scene_heading', 'action', 'character', 'other'])
    expect(retypeBlock('She waits.', 'transition')).toBe('>> She waits.')
    expect(retypeBlock('@RAJ\nHi.', 'action')).toBe('RAJ\nHi.')
    expect(retypeBlock('THE END', 'centered')).toBe('>> THE END <<')
    expect(retypeBlock('## INT. X\n& synopsis: s', 'action')).toBe('INT. X\n& synopsis: s')
    expect(blockKind(retypeBlock('RAJ\nHi.', 'character'))).toBe('character')
  })
})

describe('DOCX text extraction', () => {
  async function wordDoc(bodyXml: string): Promise<ArrayBuffer> {
    const zip = new JSZip()
    zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`)
    return zip.generateAsync({ type: 'arraybuffer' })
  }
  const p = (text: string, rPr = '') => `<w:p><w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`

  it('reads any Word document as lines, keeping emphasis and table cells', async () => {
    const buf = await wordDoc(
      p('INT. HOUSE - DAY') + '<w:p/>' + p('MEERA') + p('Hello', '<w:b/>') +
      '<w:tbl><w:tr><w:tc>' + p('A1') + '</w:tc><w:tc>' + p('B1') + '</w:tc></w:tr><w:tr><w:tc>' + p('A2') + '</w:tc></w:tr></w:tbl>')
    expect(await isSutrataDocx(buf)).toBe(false)
    expect(await readDocxText(buf)).toBe('INT. HOUSE - DAY\n\nMEERA\n**Hello**\nA1\n\nB1\n\nA2')
  })

  it("recognizes Sutrata's own DOCX so it keeps the lossless importer", async () => {
    const blob = await exportToDocx(parse('## INT. X\n\nAction.\n'))
    expect(await isSutrataDocx(await blob.arrayBuffer())).toBe(true)
  })
})

describe('AIImportDialog', () => {
  let doc!: ReturnType<typeof useDocument>
  function Probe() {
    doc = useDocument()
    React.useEffect(() => { doc.setText('---\ntitle: T\n---\n\n## OLD\n\nOld action.\n') }, []) // eslint-disable-line react-hooks/exhaustive-deps
    return null
  }
  function mount(ai: AIProvider) {
    return render(
      <TranslationProvider>
        <DocumentProvider aiProvider={ai}>
          <Probe />
          <AIImportDialog onClose={() => {}} />
        </DocumentProvider>
      </TranslationProvider>,
    )
  }

  it('sends nothing before the data policy is accepted, then formats, reviews and replaces', async () => {
    const ai = stubAIProvider({ complete: vi.fn(faithful) })
    await act(async () => { mount(ai) })
    fireEvent.change(screen.getByLabelText('…or paste the text'), { target: { value: 'INT. NEW PLACE\n\nRAJ: Namaste.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByLabelText('Data policy')).toHaveTextContent(ai.dataPolicyText)
    const go = screen.getByRole('button', { name: 'Format with AI' })
    expect(go).toBeDisabled()
    expect(ai.complete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox'))
    await act(async () => { fireEvent.click(go) })
    await waitFor(() => expect(screen.getByText(/Formatted \(2 blocks\)/)).toBeInTheDocument())
    expect(ai.complete).toHaveBeenCalledTimes(1)

    // Correct the first block's type: it is a scene heading, not action.
    fireEvent.change(screen.getByLabelText('Block 1 type'), { target: { value: 'scene_heading' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Replace script' })) })
    expect(doc.text).toBe('---\ntitle: T\n---\n\n## INT. NEW PLACE\n\n@RAJ\nNamaste.\n')
  })

  it('shows chunk problems in the review', async () => {
    const ai = stubAIProvider({ complete: vi.fn(async () => 'Something else entirely.') })
    await act(async () => { mount(ai) })
    fireEvent.change(screen.getByLabelText('…or paste the text'), { target: { value: 'She waits.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('checkbox'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Format with AI' })) })
    await waitFor(() => expect(screen.getByText('Check these parts before importing')).toBeInTheDocument())
    expect(screen.getByText(/Part 1: Missing from the result/)).toBeInTheDocument()
    expect(ai.complete).toHaveBeenCalledTimes(2)   // retried once
  })
})
