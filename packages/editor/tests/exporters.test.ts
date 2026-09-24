import { describe, it, expect } from 'vitest'
import { parse, romanizeSutra } from '@sutrata/parser'
import { exportToDocx } from '../src/file/docx-exporter'
import {
  extractWorkflowData,
  exportOneLinerCsv,
  exportShotListCsv,
  exportCastReportCsv,
  exportOneLinerDocx,
  exportShotListDocx,
  exportCastReportDocx,
  openScreenplayPrintPreview,
} from '../src/file/workflow-reports'
import JSZip from 'jszip'

const testSutra = `---
title: Test Movie
author: Writer Name
logline: A movie about testing.
date: 2026-06-13
lang: en
characters:
  JOHN: Actor One
  MARY: Actor Two
---

## Scene 1
& number: 1
& synopsis: John and Mary talk in a room.
& status: Done
& est-duration: 2m
& shots: Wide shot of the room
& shots: Close up on John

@JOHN
Hello Mary.

@MARY
(smiling)
Hi John.

@JOHN
(dialogue side-by-side)
Dual dialogue left.

@MARY ^
(dialogue side-by-side)
Dual dialogue right.

Action line here.

[[ Note text ]]

<!-- Comment text -->

===

*Lyrics here*

`

describe('Exporters', () => {
  const ast = parse(testSutra)

  it('exportToDocx generates a Blob', async () => {
    const blob = await exportToDocx(ast)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('uses Noto Serif Tamil, forced italic, for Tamil runs under the traditional style, but Noto Sans Tamil (not italic) elsewhere', async () => {
    const tamilDoc = parse('## Scene 1\n\nஇது ஒரு தமிழ் வாக்கியம்.\n')

    const traditionalBlob = await exportToDocx(tamilDoc, 'traditional')
    const traditionalXml = await (await JSZip.loadAsync(await traditionalBlob.arrayBuffer())).file('word/document.xml')!.async('text')
    expect(traditionalXml).toContain('w:ascii="Noto Serif Tamil"')
    expect(traditionalXml).not.toContain('Noto Sans Tamil')
    // forced italic even though this is a plain action line with no *emphasis* markup
    expect(traditionalXml).toMatch(/<w:rPr>\s*<w:rFonts w:ascii="Noto Serif Tamil"[^/]*\/>\s*<w:i\/>/)

    const classicBlob = await exportToDocx(tamilDoc, 'classic')
    const classicXml = await (await JSZip.loadAsync(await classicBlob.arrayBuffer())).file('word/document.xml')!.async('text')
    expect(classicXml).toContain('w:ascii="Noto Sans Tamil"')
    expect(classicXml).not.toMatch(/<w:rPr>\s*<w:rFonts w:ascii="Noto Sans Tamil"[^/]*\/>\s*<w:i\/>/)
  })

  it('never treats plain English text as the document default language\'s script (regression: lang: ta used to force every English run to Tamil\'s font/italics)', async () => {
    const mixedDoc = parse('---\ntitle: Eagle\nlang: ta\n---\n\n## EXT. COURT - DAY\n\nஇது ஒரு தமிழ் வாக்கியம்.\n')
    const blob = await exportToDocx(mixedDoc, 'traditional')
    const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('text')

    // "EAGLE" (title) and "EXT. COURT - DAY" (scene heading) are pure English: they must
    // get no run-level font override at all (inheriting the paragraph style's own font,
    // i.e. Noto Serif) rather than being forced into Tamil's font/italics.
    const englishRunPattern = /<w:rPr>\s*<w:b\/>\s*<w:bCs\/>\s*<w:i w:val="false"\/>\s*<w:iCs w:val="false"\/>\s*<\/w:rPr>\s*<w:t xml:space="preserve">EXT\. COURT - DAY<\/w:t>/
    expect(xml).toMatch(englishRunPattern)

    // The actual Tamil line still gets Noto Serif Tamil + forced italic.
    expect(xml).toMatch(/<w:rPr>\s*<w:rFonts w:ascii="Noto Serif Tamil"[^/]*\/>\s*<w:i\/>/)
  })

  it('does not force plain Latin runs to Noto Sans when the style uses a different body font', async () => {
    // Regression: createRuns used to compare the Indic-fallback font against the
    // active style's fontFamily and override the run whenever they differed —
    // which incorrectly forced every Latin run to the fallback's own "Noto Sans"
    // default instead of leaving it to inherit the paragraph style's real font
    // (e.g. Courier Prime for 'industry-courier').
    const blob = await exportToDocx(ast, 'industry-courier')
    const buffer = await blob.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('text')
    expect(xml).not.toContain('Noto Sans')
    expect(xml).toContain('CineAction')
  })

  it('extractWorkflowData correctly extracts scenes and characters', () => {
    const data = extractWorkflowData(ast)
    
    expect(data.scenes).toHaveLength(1)
    const s = data.scenes[0]!
    expect(s.number).toBe('1')
    expect(s.heading).toBe('SCENE 1')
    expect(s.synopsis).toBe('John and Mary talk in a room.')
    expect(s.status).toBe('Done')
    expect(s.estDuration).toBe('2m')
    expect(s.shots).toEqual(['Wide shot of the room', 'Close up on John'])

    // Character occurrences
    expect(data.characters).toHaveLength(2)
    const johnStats = data.characters.find(c => c.name === 'JOHN')!
    expect(johnStats).toBeDefined()
    expect(johnStats.actor).toBe('Actor One')
    expect(johnStats.sceneCount).toBe(1)
    expect(johnStats.scenes[0]).toContain('SCENE 1')
  })

  it('exportOneLinerCsv generates correct headers and rows', () => {
    const { scenes } = extractWorkflowData(ast)
    const csv = exportOneLinerCsv(scenes)
    expect(csv).toContain('Scene #,Heading,Synopsis,Actors,Status,Est-Duration')
    expect(csv).toContain('"1","SCENE 1","John and Mary talk in a room.","","Done","2m"')
  })

  it('exportShotListCsv generates correct headers and rows', () => {
    const { scenes } = extractWorkflowData(ast)
    const csv = exportShotListCsv(scenes)
    expect(csv).toContain('Scene #,Heading,Actors,Shot Details')
    expect(csv).toContain('"1","SCENE 1","","Wide shot of the room"')
    expect(csv).toContain('"1","SCENE 1","","Close up on John"')
  })

  it('exportCastReportCsv generates correct headers and rows', () => {
    const { characters } = extractWorkflowData(ast)
    const csv = exportCastReportCsv(characters)
    expect(csv).toContain('Character,Actor Name,Scene Occurrences,Scenes List')
    expect(csv).toContain('"JOHN","Actor One",1,"1: SCENE 1"')
  })

  it('exportOneLinerDocx generates a Blob', async () => {
    const { scenes } = extractWorkflowData(ast)
    const blob = await exportOneLinerDocx(scenes)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('exportShotListDocx generates a Blob', async () => {
    const { scenes } = extractWorkflowData(ast)
    const blob = await exportShotListDocx(scenes)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('exportCastReportDocx generates a Blob', async () => {
    const { characters } = extractWorkflowData(ast)
    const blob = await exportCastReportDocx(characters)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('includes a print-watermark div only when frontmatter.watermark is set', async () => {
    const originalOpen = window.open
    let written = ''
    window.open = () => ({ document: { write: (html: string) => { written = html }, close: () => {} } } as any)

    try {
      await openScreenplayPrintPreview(parse(testSutra))
      expect(written).not.toContain('class="print-watermark"')

      const watermarked = parse(testSutra.replace('lang: en', 'lang: en\nwatermark: CONFIDENTIAL DRAFT'))
      await openScreenplayPrintPreview(watermarked)
      expect(written).toContain('class="print-watermark"')
      expect(written).toContain('CONFIDENTIAL DRAFT')
    } finally {
      window.open = originalOpen
    }
  })

  it('wraps Tamil text in <i> in the print/PDF HTML under the traditional style, but not under classic (regression: print export had no per-span language tagging, so italicScripts had no effect there even though it already worked in the editor/DOCX)', async () => {
    const originalOpen = window.open
    let written = ''
    window.open = () => ({ document: { write: (html: string) => { written = html }, close: () => {} } } as any)

    try {
      const tamilDoc = parse('## Scene 1\n\nஇது ஒரு தமிழ் வாக்கியம்.\n')

      await openScreenplayPrintPreview(tamilDoc, 'Screenplay', 'traditional')
      expect(written).toMatch(/<i>[^<]*இது ஒரு தமிழ் வாக்கியம்[^<]*<\/i>/)

      await openScreenplayPrintPreview(tamilDoc, 'Screenplay', 'classic')
      expect(written).not.toContain('<i>')
    } finally {
      window.open = originalOpen
    }
  })

  it('lays the corner cover out top-left/bottom-right for traditional, and keeps the centered one for classic', async () => {
    const originalOpen = window.open
    let written = ''
    window.open = () => ({ document: { write: (html: string) => { written = html }, close: () => {} } } as any)

    try {
      await openScreenplayPrintPreview(ast, 'Screenplay', 'traditional')
      expect(written).toContain('class="print-cover-page print-cover-corners"')
      // One "by <author>" line in the top block, not the centered layout's split pair.
      expect(written).toContain('<div class="print-cover-author">by Writer Name</div>')
      expect(written).not.toContain('<div class="print-cover-by">')

      await openScreenplayPrintPreview(ast, 'Screenplay', 'classic')
      expect(written).toContain('class="print-cover-page print-cover-centered"')
      expect(written).toContain('<div class="print-cover-by">by</div>')
    } finally {
      window.open = originalOpen
    }
  })

  it('puts the docx corner cover\'s date/contact in an indented bottom block (traditional) but centers them (classic)', async () => {
    const paragraphs = async (styleId: string) => {
      const zip = await JSZip.loadAsync(await (await exportToDocx(ast, styleId)).arrayBuffer())
      const doc = await zip.file('word/document.xml')!.async('string')
      const cover = doc.slice(0, doc.indexOf('w:br w:type="page"'))
      return (cover.match(/<w:p>.*?<\/w:p>/gs) ?? []).map(p => ({
        text: [...p.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map(m => m[1]).join(''),
        indent: p.match(/w:ind w:left="(\d+)"/)?.[1],
        centered: p.includes('w:jc w:val="center"'),
      })).filter(p => p.text)
    }

    const corners = await paragraphs('traditional')
    expect(corners.map(p => p.text)).toContain('by Writer Name')
    const cornerDate = corners.find(p => p.text === '2026-06-13')!
    expect(Number(cornerDate.indent)).toBeGreaterThan(0)
    expect(cornerDate.centered).toBe(false)

    const centered = await paragraphs('classic')
    expect(centered.map(p => p.text)).toContain('by') // on its own line
    expect(centered.map(p => p.text)).not.toContain('by Writer Name')
    expect(centered.find(p => p.text === '2026-06-13')!.centered).toBe(true)
  })

  it('hands the print document a paginator and the scene tags its headers need', async () => {
    const originalOpen = window.open
    let written = ''
    window.open = () => ({ document: { write: (html: string) => { written = html }, close: () => {} } } as any)

    try {
      await openScreenplayPrintPreview(parse('## INT. ROOM - DAY {#8}\n\nAction line.\n'))
      expect(written).toContain('<div id="print-pages">')
      expect(written).toContain('<div id="print-flow">')
      // The heading marks where scene 8 starts; its action blocks only say they belong to it.
      expect(written).toContain('data-scene="8" data-scene-start="8"')
      expect(written).toMatch(/<div data-scene="8" class="print-action"/)
      expect(written).toContain('paginatePrintDocument')
      expect(written).toContain('"continuedSuffix":"CONTINUED:"')
    } finally {
      window.open = originalOpen
    }
  })

  it('labels scenes by position when they carry no number of their own', async () => {
    const originalOpen = window.open
    let written = ''
    window.open = () => ({ document: { write: (html: string) => { written = html }, close: () => {} } } as any)

    try {
      await openScreenplayPrintPreview(parse('## INT. ROOM - DAY\n\nOne.\n\n## EXT. ROAD - DAY\n\nTwo.\n'))
      expect(written).toContain('data-scene="1" data-scene-start="1"')
      expect(written).toContain('data-scene="2" data-scene-start="2"')
    } finally {
      window.open = originalOpen
    }
  })

  it('gives the docx a "p<n>" page-number header and leaves the cover page bare', async () => {
    const zip = await JSZip.loadAsync(await (await exportToDocx(ast)).arrayBuffer())
    const headers = await Promise.all(
      Object.keys(zip.files).filter(f => /header\d*\.xml$/.test(f)).map(f => zip.file(f)!.async('string'))
    )
    const running = headers.find(h => h.includes('PAGE'))!
    expect(running).toContain('<w:t xml:space="preserve">p</w:t>')
    expect(running).toContain('<w:instrText xml:space="preserve">PAGE</w:instrText>')
    expect(running).toContain('w:jc w:val="right"')
    // Cover page: its own (empty) header, and numbered 0 so the script itself starts at p1.
    const doc = await zip.file('word/document.xml')!.async('string')
    expect(doc).toContain('<w:titlePg/>')
    expect(doc).toContain('<w:pgNumType w:start="0"/>')
    expect(headers.some(h => !h.includes('PAGE'))).toBe(true)
  })

  it('openScreenplayPrintPreview runs without error', () => {
    const originalOpen = window.open
    let mockDoc = {
      write: () => {},
      close: () => {}
    }
    window.open = () => ({ document: mockDoc } as any)

    try {
      expect(() => openScreenplayPrintPreview(ast)).not.toThrow()
    } finally {
      window.open = originalOpen
    }
  })
})

describe('romanized export', () => {
  const hindi = `---
title: आख़िरी ट्रेन
lang: hi
lang-secondary: [en]
---

## INT. रेलवे स्टेशन - रात {#sc1}

@विक्रम
हम ट्रेन छूट गए, है ना?
`

  it('feeds a romanized copy through the DOCX exporter', async () => {
    const doc = parse(romanizeSutra(hindi, { scope: 'all', variant: 'strict' }))
    const blob = await exportToDocx(doc)
    const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('text')
    expect(xml).toContain('hama ṭrēna chūṭa gaē, hai nā?')
    expect(xml).toContain('VIKRAM')                       // name uses primary-language convention (cue uppercased by the exporter)
    expect(xml).toContain('ROMANIZED COPY')
    expect(xml).not.toContain('PAGE REFERENCE')
    expect(xml).not.toMatch(/[\u0900-\u097F]/)            // no Devanagari left in the body
  })

  it('romanizes workflow reports from a fully romanized copy', () => {
    const src = hindi.replace('{#sc1}\n', '{#sc1}\n& synopsis: विक्रम ट्रेन छूटने का सच जानता है।\n')
    const data = extractWorkflowData(parse(romanizeSutra(src, { scope: 'all', variant: 'readable', notice: false })))
    const csv = exportOneLinerCsv(data.scenes)
    expect(csv).toContain('INT. RELAVE SṬEŚAN - RĀT')   // report uppercases headings; readable drops only word-final vowels
    expect(csv).toContain('Vikram ṭren chūṭane kā sac jānatā hai.')
    expect(exportCastReportCsv(data.characters)).toContain('"VIKRAM"')   // cast report uppercases names
  })

  it('dialogue scope leaves headings in native script', async () => {
    const doc = parse(romanizeSutra(hindi, { scope: 'dialogue', variant: 'readable' }))
    const blob = await exportToDocx(doc)
    const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('text')
    expect(xml).toContain('रेलवे स्टेशन')
    expect(xml).toContain('ham ṭren chūṭ gae, hai nā?')
  })
})
