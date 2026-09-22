import JSZip from 'jszip'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

/** Paragraph styles produced by docx-exporter.ts that mark actual screenplay body content
 *  (as opposed to the free-form title-page paragraphs, which carry no style, or CineTitle /
 *  CineAuthor / CineLogline, which belong to the title page and are not reimported here). */
const BODY_STYLES = new Set([
  'CineSceneHeading', 'CineSection', 'CineAction', 'CineCharacter',
  'CineParenthetical', 'CineDialogue', 'CineTransition', 'CineCentered',
  'CineLyrics', 'CineNote', 'CineComment',
])

interface RunFlags {
  bold: boolean
  italic: boolean
  underline: boolean
}

interface ParsedParagraph {
  style: string | null
  text: string
  runs: (RunFlags & { text: string })[]
  isPageBreak: boolean
}

interface ParsedTable {
  cells: ParsedParagraph[][]
}

type BodyItem = { kind: 'para'; para: ParsedParagraph } | { kind: 'table'; table: ParsedTable }

export interface DocxImportResult {
  /** Reconstructed Sutra body text (no frontmatter), or null if nothing importable was found. */
  bodyText: string | null
  warnings: string[]
}

function attrVal(el: Element, tag: string): string | null {
  const child = el.getElementsByTagNameNS(W_NS, tag)[0]
  if (!child) return null
  const val = child.getAttributeNS(W_NS, 'val')
  return val
}

function flagOn(el: Element, tag: string): boolean {
  const child = el.getElementsByTagNameNS(W_NS, tag)[0]
  if (!child) return false
  const val = child.getAttributeNS(W_NS, 'val')
  if (val === null) return true
  return !['false', '0', 'off', 'none'].includes(val.toLowerCase())
}

function parseParagraph(p: Element): ParsedParagraph {
  let style: string | null = null
  const runs: (RunFlags & { text: string })[] = []
  let isPageBreak = false

  for (const child of Array.from(p.children)) {
    if (child.localName === 'pPr') {
      style = attrVal(child, 'pStyle')
      continue
    }
    if (child.localName === 'r') {
      const rPr = child.getElementsByTagNameNS(W_NS, 'rPr')[0]
      const bold = !!rPr && flagOn(rPr, 'b')
      const italic = !!rPr && flagOn(rPr, 'i')
      const underline = !!rPr && flagOn(rPr, 'u')
      let text = ''
      for (const rc of Array.from(child.children)) {
        if (rc.localName === 't') text += rc.textContent ?? ''
        // Word normalizes a literal tab character inside <w:t> (what docx.js emits) into a
        // <w:tab/> element when it resaves the file — recognize both forms.
        else if (rc.localName === 'tab') text += '\t'
        else if (rc.localName === 'br') isPageBreak = true
      }
      if (text) runs.push({ text, bold, italic, underline })
    }
  }

  return { style, text: runs.map(r => r.text).join(''), runs, isPageBreak }
}

function parseTable(tbl: Element): ParsedTable {
  const tr = tbl.getElementsByTagNameNS(W_NS, 'tr')[0]
  const cells: ParsedParagraph[][] = []
  if (tr) {
    for (const tc of Array.from(tr.children)) {
      if (tc.localName !== 'tc') continue
      const paras = Array.from(tc.children)
        .filter(c => c.localName === 'p')
        .map(p => parseParagraph(p))
      cells.push(paras)
    }
  }
  return { cells }
}

/** Rebuilds bold/italic/underline markup from formatting runs, matching the parser's inline syntax.
 *  Types that don't support inline spans in Sutra source (headings, character cues, notes, etc.)
 *  should pass all three `allow` flags false so forced style formatting (e.g. bold character names)
 *  isn't reinterpreted as user markup. */
function renderInline(
  runs: (RunFlags & { text: string })[],
  opts: { allowBold: boolean; allowItalic: boolean; allowUnderline: boolean }
): string {
  let out = ''
  for (const r of runs) {
    const bold = opts.allowBold && r.bold
    const italic = opts.allowItalic && r.italic
    const underline = opts.allowUnderline && r.underline
    let text = r.text
    if (!text) continue
    if (underline) text = `_${text}_`
    if (italic) text = `*${text}*`
    if (bold) text = `**${text}**`
    out += text
  }
  return out
}

function plainText(para: ParsedParagraph): string {
  return para.text
}

function splitNameExtension(text: string): { name: string; extension: string | null } {
  const m = text.trim().match(/^(.*)\s(\([^()]*\))$/)
  if (m) return { name: m[1]!.trim(), extension: m[2]! }
  return { name: text.trim(), extension: null }
}

function renderCharacterLine(text: string, isDual: boolean): string {
  const { name, extension } = splitNameExtension(text)
  return `@${name}${extension ? ` ${extension}` : ''}${isDual ? ' ^' : ''}`
}

function renderSceneHeading(para: ParsedParagraph): string {
  const text = plainText(para)
  const tabIdx = text.indexOf('\t')
  if (tabIdx === -1) return `## ${text.trim()}`
  const heading = text.slice(0, tabIdx).trim()
  const id = text.slice(tabIdx + 1).trim()
  return id ? `## ${heading} {#${id}}` : `## ${heading}`
}

class BlockBuilder {
  private blocks: string[] = []
  private charLines: string[] | null = null
  unstyledCount = 0

  private flushChar() {
    if (this.charLines) {
      this.blocks.push(this.charLines.join('\n'))
      this.charLines = null
    }
  }

  push(block: string) {
    this.flushChar()
    this.blocks.push(block)
  }

  startCharacter(line: string) {
    this.flushChar()
    this.charLines = [line]
  }

  appendToCharacter(line: string): boolean {
    if (!this.charLines) return false
    this.charLines.push(line)
    return true
  }

  finish(): string {
    this.flushChar()
    return this.blocks.join('\n\n')
  }
}

function addParagraph(para: ParsedParagraph, builder: BlockBuilder) {
  if (para.isPageBreak) {
    builder.push('===')
    return
  }
  const text = plainText(para).trim()

  switch (para.style) {
    case 'CineSceneHeading':
      builder.push(renderSceneHeading(para))
      return
    case 'CineSection':
      builder.push(`# ${text}`)
      return
    case 'CineAction': {
      const rendered = renderInline(para.runs, { allowBold: true, allowItalic: true, allowUnderline: true })
      if (rendered.trim()) builder.push(rendered)
      return
    }
    case 'CineCharacter':
      builder.startCharacter(renderCharacterLine(text, false))
      return
    case 'CineParenthetical':
      if (!builder.appendToCharacter(text)) builder.push(text)
      return
    case 'CineDialogue': {
      const rendered = renderInline(para.runs, { allowBold: true, allowItalic: true, allowUnderline: true })
      if (!builder.appendToCharacter(rendered)) builder.push(rendered)
      return
    }
    case 'CineTransition':
      builder.push(`>> ${text}`)
      return
    case 'CineCentered':
      builder.push(`>> ${text} <<`)
      return
    case 'CineLyrics': {
      const rendered = renderInline(para.runs, { allowBold: true, allowItalic: false, allowUnderline: true })
      builder.push(`~ ${rendered}`)
      return
    }
    case 'CineNote':
      builder.push(text)
      return
    case 'CineComment':
      builder.push(text)
      return
    default: {
      if (!text) return
      builder.unstyledCount++
      const rendered = renderInline(para.runs, { allowBold: true, allowItalic: true, allowUnderline: true })
      builder.push(rendered)
    }
  }
}

function isBodyStart(item: BodyItem): boolean {
  if (item.kind === 'table') return true
  return item.para.style !== null && BODY_STYLES.has(item.para.style)
}

/** Parses a .docx file (as produced by exportToDocx, possibly re-saved from Word with
 *  corrections and/or font changes) back into Sutra body text. The title page, if any,
 *  is not reimported — only content carrying the CineXxx paragraph styles the exporter
 *  applies to the screenplay body is recognized. */
export async function importDocx(buffer: ArrayBuffer): Promise<DocxImportResult> {
  const warnings: string[] = []
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new Error('This file is not a valid .docx (Word) document.')
  }
  const docXml = zip.file('word/document.xml')
  if (!docXml) throw new Error('This file is not a valid .docx (Word) document.')
  const xmlText = await docXml.async('text')

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml')
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Could not read the Word document — its XML appears corrupted.')
  }
  const body = xmlDoc.getElementsByTagNameNS(W_NS, 'body')[0]
  if (!body) throw new Error('This .docx file has no document body.')

  const items: BodyItem[] = []
  for (const child of Array.from(body.children)) {
    if (child.localName === 'p') items.push({ kind: 'para', para: parseParagraph(child) })
    else if (child.localName === 'tbl') items.push({ kind: 'table', table: parseTable(child) })
  }

  const startIdx = items.findIndex(isBodyStart)
  if (startIdx === -1) {
    warnings.push('No Sutrata screenplay content was found in this document — nothing was imported.')
    return { bodyText: null, warnings }
  }

  const builder = new BlockBuilder()
  let skippedTables = 0

  for (let i = startIdx; i < items.length; i++) {
    const item = items[i]!
    if (item.kind === 'para') {
      addParagraph(item.para, builder)
      continue
    }
    // dual-dialogue table: exactly two cells, each a character block
    if (item.table.cells.length !== 2) {
      skippedTables++
      continue
    }
    const [left, right] = item.table.cells as [ParsedParagraph[], ParsedParagraph[]]
    for (const p of left) addParagraph(p, builder)
    const rightFirst = right[0]
    if (rightFirst && rightFirst.style === 'CineCharacter') {
      builder.startCharacter(renderCharacterLine(plainText(rightFirst).trim(), true))
      for (const p of right.slice(1)) addParagraph(p, builder)
    } else {
      for (const p of right) addParagraph(p, builder)
    }
  }

  const bodyText = builder.finish()

  if (builder.unstyledCount > 0) {
    warnings.push(`${builder.unstyledCount} paragraph(s) had no recognized Sutrata style and were imported as action lines.`)
  }
  if (skippedTables > 0) {
    warnings.push(`${skippedTables} table(s) in the document were not recognized as dual dialogue and were skipped.`)
  }
  warnings.push('The title page was not imported — edit it from the Title Page panel if it also needs corrections.')

  return { bodyText: bodyText || null, warnings }
}
