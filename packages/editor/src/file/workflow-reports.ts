import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx'
import type { DocumentNode, SceneHeadingNode, ContentNode } from '@sutra/parser'
import { resolveStyle } from '../styles/registry'
import { styleToPrintCss } from '../styles/print-adapter'
import { embedFontFacesFor } from '../styles/embed-fonts'
import { SCRIPT_UNICODE_RANGES } from '../styles/script-ranges'
import { printPaginatorScript } from './print-paginator'
// CSS absolute units are fixed at 96px/in, print included — so a page box sized in px
// from the paper's inches lands exactly on one sheet.
const CSS_PX_PER_IN = 96
import { DEFAULT_COVER_LAYOUT } from '../styles/types'
import type { ScreenplayStyleDefinition } from '../styles/types'

// CSV Escape Helper
function esc(val: string): string {
  const str = val ? String(val) : ''
  return `"${str.replace(/"/g, '""')}"`
}

export interface WorkflowSceneData {
  number: string
  heading: string
  synopsis: string
  actors: string
  status: string
  estDuration: string
  shots: string[]
}

export interface CharacterStats {
  name: string
  actor: string
  sceneCount: number
  scenes: string[]
}

/** Extract all relevant workflow data from AST */
export function extractWorkflowData(ast: DocumentNode): {
  scenes: WorkflowSceneData[]
  characters: CharacterStats[]
} {
  const scenes: WorkflowSceneData[] = []
  const charMap = new Map<string, { sceneCount: number; scenes: string[] }>()

  // Resolve character registry from frontmatter
  const fmCharacters = (ast.frontmatter?.data as Record<string, unknown> | undefined)?.[
    'characters'
  ] as Record<string, string> | undefined

  let sceneCount = 0
  for (const node of ast.children) {
    if (node.type === 'scene-heading') {
      sceneCount++
      const rawHeading = node.text.toUpperCase()

      // Find metadata keys
      const numMeta = node.metadata.find(m => m.key === 'number')?.value
      const sceneNum = numMeta || node.id || String(sceneCount)
      const synopsis = node.metadata.find(m => m.key === 'synopsis')?.value ?? ''
      const actors = node.metadata.find(m => m.key === 'actors')?.value ?? ''
      const status = node.metadata.find(m => m.key === 'status')?.value ?? ''
      const estDuration = node.metadata.find(m => m.key === 'est-duration')?.value ?? ''

      // Collect all shot metadata lines
      const shotLines = node.metadata.filter(m => m.key === 'shots').map(m => m.value)

      scenes.push({
        number: sceneNum,
        heading: rawHeading,
        synopsis,
        actors,
        status,
        estDuration,
        shots: shotLines,
      })

      // Walk this scene's children to find characters
      const sceneLabel = `${sceneNum}: ${rawHeading}`
      const seenChars = new Set<string>()

      const checkChar = (charName: string) => {
        const name = charName.trim().toUpperCase()
        if (!name) return
        if (seenChars.has(name)) return
        seenChars.add(name)

        if (!charMap.has(name)) {
          charMap.set(name, { sceneCount: 0, scenes: [] })
        }
        const stats = charMap.get(name)!
        stats.sceneCount++
        stats.scenes.push(sceneLabel)
      }

      for (const sc of node.children) {
        if (sc.type === 'character') {
          checkChar(sc.name)
        } else if (sc.type === 'dual-dialogue') {
          checkChar(sc.left.name)
          checkChar(sc.right.name)
        }
      }
    }
  }

  // Build character list
  const characters: CharacterStats[] = []
  for (const [name, stats] of charMap.entries()) {
    const actor = fmCharacters?.[name] || fmCharacters?.[name.toLowerCase()] || ''
    characters.push({
      name,
      actor,
      sceneCount: stats.sceneCount,
      scenes: stats.scenes,
    })
  }

  // Sort characters by occurrence count descending
  characters.sort((a, b) => b.sceneCount - a.sceneCount)

  return { scenes, characters }
}

// ---------------------------------------------------------
// CSV Exporters
// ---------------------------------------------------------

export function exportOneLinerCsv(scenes: WorkflowSceneData[]): string {
  const header = 'Scene #,Heading,Synopsis,Actors,Status,Est-Duration\n'
  const rows = scenes
    .map(
      s =>
        `${esc(s.number)},${esc(s.heading)},${esc(s.synopsis)},${esc(s.actors)},${esc(s.status)},${esc(s.estDuration)}`
    )
    .join('\n')
  return header + rows
}

export function exportShotListCsv(scenes: WorkflowSceneData[]): string {
  const header = 'Scene #,Heading,Actors,Shot Details\n'
  const rows: string[] = []
  for (const s of scenes) {
    if (s.shots.length === 0) {
      rows.push(`${esc(s.number)},${esc(s.heading)},${esc(s.actors)},""`)
    } else {
      for (const shot of s.shots) {
        rows.push(`${esc(s.number)},${esc(s.heading)},${esc(s.actors)},${esc(shot)}`)
      }
    }
  }
  return header + rows.join('\n')
}

export function exportCastReportCsv(characters: CharacterStats[]): string {
  const header = 'Character,Actor Name,Scene Occurrences,Scenes List\n'
  const rows = characters
    .map(
      c =>
        `${esc(c.name)},${esc(c.actor)},${c.sceneCount},${esc(c.scenes.join('; '))}`
    )
    .join('\n')
  return header + rows
}

// ---------------------------------------------------------
// DOCX Table Exporters
// ---------------------------------------------------------

function makeCell(text: string, bold = false, widthPercent = 0): TableCell {
  return new TableCell({
    width: widthPercent > 0 ? { size: widthPercent, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold,
            font: 'Courier Prime',
            size: '10pt',
          }),
        ],
      }),
    ],
  })
}

export async function exportOneLinerDocx(scenes: WorkflowSceneData[]): Promise<Blob> {
  const headerRow = new TableRow({
    children: [
      makeCell('Scene #', true, 10),
      makeCell('Heading', true, 25),
      makeCell('Synopsis', true, 35),
      makeCell('Actors', true, 15),
      makeCell('Status', true, 10),
      makeCell('Duration', true, 5),
    ],
  })

  const rows = [headerRow]
  for (const s of scenes) {
    rows.push(
      new TableRow({
        children: [
          makeCell(s.number, false, 10),
          makeCell(s.heading, false, 25),
          makeCell(s.synopsis, false, 35),
          makeCell(s.actors, false, 15),
          makeCell(s.status, false, 10),
          makeCell(s.estDuration, false, 5),
        ],
      })
    )
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'ONE-LINER SCHEDULE / SCENE BREAKDOWN',
                bold: true,
                font: 'Courier Prime',
                size: '14pt',
              }),
            ],
            spacing: { after: 288 },
          }),
          table,
        ],
      },
    ],
  })

  return Packer.toBlob(doc)
}

export async function exportShotListDocx(scenes: WorkflowSceneData[]): Promise<Blob> {
  const headerRow = new TableRow({
    children: [
      makeCell('Scene #', true, 10),
      makeCell('Heading', true, 25),
      makeCell('Actors', true, 20),
      makeCell('Shot Details', true, 45),
    ],
  })

  const rows = [headerRow]
  for (const s of scenes) {
    const shotDetails = s.shots.join('\n')
    rows.push(
      new TableRow({
        children: [
          makeCell(s.number, false, 10),
          makeCell(s.heading, false, 25),
          makeCell(s.actors, false, 20),
          makeCell(shotDetails || 'No shots specified', false, 45),
        ],
      })
    )
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'SHOT LIST REPORT',
                bold: true,
                font: 'Courier Prime',
                size: '14pt',
              }),
            ],
            spacing: { after: 288 },
          }),
          table,
        ],
      },
    ],
  })

  return Packer.toBlob(doc)
}

export async function exportCastReportDocx(characters: CharacterStats[]): Promise<Blob> {
  const headerRow = new TableRow({
    children: [
      makeCell('Character', true, 25),
      makeCell('Actor Name', true, 25),
      makeCell('Occurrences', true, 15),
      makeCell('Scenes List', true, 35),
    ],
  })

  const rows = [headerRow]
  for (const c of characters) {
    rows.push(
      new TableRow({
        children: [
          makeCell(c.name, false, 25),
          makeCell(c.actor || 'TBD', false, 25),
          makeCell(String(c.sceneCount), false, 15),
          makeCell(c.scenes.join(', '), false, 35),
        ],
      })
    )
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'CHARACTER OCCURRENCE / CAST REPORT',
                bold: true,
                font: 'Courier Prime',
                size: '14pt',
              }),
            ],
            spacing: { after: 288 },
          }),
          table,
        ],
      },
    ],
  })

  return Packer.toBlob(doc)
}

// ---------------------------------------------------------
// Print Preview Page Generator (HTML)
// ---------------------------------------------------------

export async function openPrintPreview(scenes: WorkflowSceneData[], title = 'One-Liner Schedule') {
  // Open synchronously (inside the click) so popup blockers allow it, then embed fonts.
  const win = window.open('', '_blank')
  if (!win) return
  // Noto Sans carries every ISO 15919 letter and mark, for romanized reports; the new
  // window has no stylesheet of its own.
  const fontFaceCss = await embedFontFacesFor(['Noto Sans'])

  const rowsHtml = scenes
    .map(
      s => `
    <tr>
      <td>${s.number}</td>
      <td><strong>${s.heading}</strong></td>
      <td>${s.synopsis || '<span class="empty">No synopsis</span>'}</td>
      <td>${s.actors || '-'}</td>
      <td><span class="status-badge status-${s.status.toLowerCase().replace(/\s+/g, '-') || 'none'}">${s.status || '-'}</span></td>
      <td>${s.estDuration || '-'}</td>
    </tr>
  `
    )
    .join('')

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          ${fontFaceCss}
          body {
            font-family: 'Noto Sans', 'Courier Prime', sans-serif;
            margin: 40px;
            color: #333;
          }
          h1 {
            font-family: 'Courier Prime', sans-serif;
            text-align: center;
            font-size: 20px;
            margin-bottom: 30px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 10px 12px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background-color: #f7f7f5;
            font-weight: 600;
          }
          .empty {
            color: #999;
            font-style: italic;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            background: #f0f0f0;
            border: 1px solid #ddd;
          }
          .status-done, .status-revised { background: #e6f4ea; color: #137333; border-color: #ceead6; }
          .status-wip { background: #fef7e0; color: #b06000; border-color: #feebc8; }
          .status-draft { background: #fce8e6; color: #c5221f; border-color: #fad2cf; }

          @media print {
            body { margin: 20px; }
            button { display: none !important; }
            th { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; }
          }

          .print-btn-bar {
            text-align: right;
            margin-bottom: 20px;
          }
          .print-btn {
            background: #1976d2;
            color: white;
            border: none;
            padding: 8px 16px;
            font-size: 13px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
          }
          .print-btn:hover { background: #1565c0; }
        </style>
      </head>
      <body>
        <div class="print-btn-bar">
          <button class="print-btn" onclick="window.print()">Print Schedule</button>
        </div>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>
              <th style="width: 8%">Scene #</th>
              <th style="width: 25%">Heading</th>
              <th style="width: 35%">Synopsis</th>
              <th style="width: 15%">Actors</th>
              <th style="width: 12%">Status</th>
              <th style="width: 5%">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `)
  win.document.close()
}

/** Print Screenplay Preview in formatted style. `styleOverride` picks a style id for
 *  this export only (without touching the document); otherwise the document's
 *  frontmatter `style:` field is used, falling back to the default style. `skipNotes`
 *  omits both block-level and inline `[[ ]]` notes from the exported document. */
export async function openScreenplayPrintPreview(
  ast: DocumentNode,
  title = 'Screenplay',
  styleOverride?: string,
  customStyles: ScreenplayStyleDefinition[] = [],
  skipNotes = false,
) {
  const html = await buildScreenplayPrintHtml(ast, title, styleOverride, customStyles, skipNotes)

  // Desktop shell: generate a real vector-text PDF via the platform's browser
  // engine (WebView2 PrintToPdf on Windows) instead of the OS print dialog,
  // which avoids the rasterized/bloated output some print-to-PDF drivers produce.
  const api = window.desktopAPI
  if (api?.exportScreenplayToPdf && api?.showSavePdfDialog) {
    const defaultName = `${title.replace(/[\\/:*?"<>|]/g, '_')}.pdf`
    const path = await api.showSavePdfDialog(defaultName)
    if (!path) return
    await api.exportScreenplayToPdf(html, path)
    return
  }

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

async function buildScreenplayPrintHtml(
  ast: DocumentNode,
  title: string,
  styleOverride?: string,
  customStyles: ScreenplayStyleDefinition[] = [],
  skipNotes = false,
): Promise<string> {
  const frontmatter = ast.frontmatter?.data as Record<string, unknown> | undefined
  const defaultLang = (frontmatter?.['lang'] as string) ?? 'en'
  const style = resolveStyle(styleOverride ?? (frontmatter?.['style'] as string | undefined), customStyles)
  // Noto Sans is the Latin fallback in the print font stack (print-adapter.ts), so embed it
  // too: the desktop's hidden print webview cannot load /fonts/ paths on its own.
  const embeddedFontFaceCss = await embedFontFacesFor([...new Set([
    style.fontFamily,
    ...Object.values(style.complexScriptFontOverrides ?? {}),
    'Noto Sans',
  ])])

  // Paper the export prints on — frontmatter's `page:`, the same field docx-exporter.ts
  // reads. print-paginator.ts needs it in CSS px to size its page boxes.
  const pageFormat = (frontmatter?.['page'] as string)?.toLowerCase() === 'a4' ? 'a4' : 'letter'
  const pageHeightIn = pageFormat === 'a4' ? 11.69 : 11

  const watermarkValue = typeof frontmatter?.['watermark'] === 'string' ? frontmatter['watermark'].trim() : ''
  const watermarkHtml = watermarkValue ? `<div class="print-watermark">${escapeHtml(watermarkValue)}</div>` : ''

  // Render cover page
  let coverPageHtml = ''
  if (frontmatter && (frontmatter['title'] || frontmatter['author'])) {
    const titleText = String(frontmatter['title'] || 'Untitled')
    const authorText = String(frontmatter['author'] || '')
    const loglineText = String(frontmatter['logline'] || '')
    const dateText = String(frontmatter['date'] || '')
    const contactText = String(frontmatter['contact'] || '')

    // Both cover layouts share this markup — the two blocks are what 'corners' pushes
    // into opposite corners and 'centered' just stacks (see print-adapter.ts). The
    // byline differs: 'corners' prints one "by <author>" line, 'centered' keeps the
    // classic "by" / author on separate lines.
    const corners = (style.coverLayout ?? DEFAULT_COVER_LAYOUT) === 'corners'
    const bylineHtml = corners
      ? `<div class="print-cover-author">by ${textHtml(authorText)}</div>`
      : `<div class="print-cover-by">by</div>
         <div class="print-cover-author">${textHtml(authorText)}</div>`
    coverPageHtml = `
      <div class="print-cover-page print-cover-${corners ? 'corners' : 'centered'}">
        <div class="print-cover-top">
          <div class="print-cover-title">${textHtml(titleText)}</div>
          ${bylineHtml}
          ${loglineText ? `<div class="print-cover-logline">${textHtml(loglineText)}</div>` : ''}
        </div>
        <div class="print-cover-bottom">
          ${dateText ? `<div class="print-cover-date">${escapeHtml(dateText)}</div>` : ''}
          ${contactText ? `<div class="print-cover-contact">${escapeHtml(contactText)}</div>` : ''}
        </div>
      </div>
    `
  }

  // Render screenplay nodes
  let bodyHtml = ''
  
  function renderSpans(spans: any[]): string {
    return spans.map(s => {
      if (s.type === 'text') return textHtml(s.text)
      if (s.type === 'bold') return `<strong>${renderSpans(s.spans)}</strong>`
      if (s.type === 'italic') return `<em>${renderSpans(s.spans)}</em>`
      if (s.type === 'underline') return `<u>${renderSpans(s.spans)}</u>`
      if (s.type === 'note') return skipNotes ? '' : `<span class="print-note">[[ ${textHtml(s.text)} ]]</span>`
      return ''
    }).join('')
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  /** Whether `text` contains a script this style forces italic by default
   *  (`italicScripts`, e.g. Traditional's Tamil) — mirrors docx-exporter.ts's
   *  createRuns forced-italic behavior, which the live editor and DOCX export
   *  already have but the print/PDF HTML never did (no per-span language tagging
   *  there), so Tamil rendered upright in exported PDFs even under Traditional. */
  function forceItalic(text: string): boolean {
    if (!style.italicScripts?.length) return false
    return style.italicScripts.some(code => SCRIPT_UNICODE_RANGES[code]?.test(text))
  }

  /** escapeHtml, plus <i>-wrapping when forceItalic(text) — italic always,
   *  even inside otherwise-bold/underlined elements like Traditional's scene
   *  headings and character cues, matching the confirmed docx-exporter.ts behavior. */
  function textHtml(text: string): string {
    const escaped = escapeHtml(text)
    return forceItalic(text) ? `<i>${escaped}</i>` : escaped
  }

  function renderContentNode(n: ContentNode): string {
    if (n.type === 'action') {
      return `<div class="print-action">${renderSpans(n.spans)}</div>`
    }
    if (n.type === 'character') {
      const ext = n.extension ? ` ${n.extension.toUpperCase()}` : ''
      const childHtml = n.children.map(c => {
        if (c.type === 'parenthetical') {
          return `<div class="print-parenthetical">(${textHtml(c.text)})</div>`
        } else {
          return `<div class="print-dialogue">${renderSpans(c.spans)}</div>`
        }
      }).join('')

      return `
        <div class="print-character-block">
          <div class="print-character">${textHtml(n.name.toUpperCase())}${textHtml(ext)}</div>
          ${childHtml}
        </div>
      `
    }
    if (n.type === 'transition') {
      return `<div class="print-transition">${textHtml(n.text.toUpperCase())}</div>`
    }
    if (n.type === 'centered') {
      return `<div class="print-centered">${textHtml(n.text)}</div>`
    }
    if (n.type === 'lyrics') {
      return `<div class="print-lyrics">${renderSpans(n.spans)}</div>`
    }
    if (n.type === 'note') {
      return skipNotes ? '' : `<div class="print-note">${textHtml(n.text)}</div>`
    }
    if (n.type === 'comment') {
      return `<div class="print-comment">&lt;!-- ${textHtml(n.text)} --&gt;</div>`
    }
    if (n.type === 'page-break') {
      return `<div class="print-page-break"></div>`
    }
    if (n.type === 'dual-dialogue') {
      const leftChar = n.left
      const leftExt = leftChar.extension ? ` ${leftChar.extension.toUpperCase()}` : ''
      const leftChildHtml = leftChar.children.map(c => {
        if (c.type === 'parenthetical') {
          return `<div class="print-parenthetical">(${textHtml(c.text)})</div>`
        } else {
          return `<div class="print-dialogue">${renderSpans(c.spans)}</div>`
        }
      }).join('')

      const rightChar = n.right
      const rightExt = rightChar.extension ? ` ${rightChar.extension.toUpperCase()}` : ''
      const rightChildHtml = rightChar.children.map(c => {
        if (c.type === 'parenthetical') {
          return `<div class="print-parenthetical">(${textHtml(c.text)})</div>`
        } else {
          return `<div class="print-dialogue">${renderSpans(c.spans)}</div>`
        }
      }).join('')

      return `
        <div class="print-dual-dialogue">
          <div class="print-dual-column print-left-column">
            <div class="print-character">${textHtml(leftChar.name.toUpperCase())}${textHtml(leftExt)}</div>
            ${leftChildHtml}
          </div>
          <div class="print-dual-column print-right-column">
            <div class="print-character">${textHtml(rightChar.name.toUpperCase())}${textHtml(rightExt)}</div>
            ${rightChildHtml}
          </div>
        </div>
      `
    }
    return ''
  }

  /** Stamps the scene a block belongs to onto its outermost element, which is how
   *  print-paginator.ts decides whether a page opens mid-scene (-> "8 CONTINUED:") or on
   *  a fresh one. The label is the scene's own number when it has one, else its position
   *  in the script — the same thing the heading prints on the right. */
  function tagScene(html: string, label: string, isHeading = false): string {
    const attrs = ` data-scene="${escapeHtml(label)}"${isHeading ? ` data-scene-start="${escapeHtml(label)}"` : ''}`
    return html.replace('<div', `<div${attrs}`)
  }

  let sceneOrdinal = 0
  for (const node of ast.children) {
    if (node.type === 'section') {
      bodyHtml += `<div class="print-section print-sect-${node.level}">${textHtml(node.text)}</div>`
      for (const sub of node.children) {
        bodyHtml += renderContentNode(sub)
      }
    } else if (node.type === 'scene-heading') {
      sceneOrdinal++
      const sceneLabel = node.id || String(sceneOrdinal)
      bodyHtml += tagScene(`
        <div class="print-scene-heading">
          <span class="print-scene-title">${textHtml(node.text.toUpperCase())}</span>
          ${node.id ? `<span class="print-scene-num">${escapeHtml(node.id)}</span>` : ''}
        </div>
      `, sceneLabel, true)
      for (const sub of node.children) {
        bodyHtml += tagScene(renderContentNode(sub), sceneLabel)
      }
    } else {
      bodyHtml += renderContentNode(node)
    }
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Noto+Sans+Devanagari&family=Noto+Sans+Tamil&family=Noto+Sans+Telugu&family=Noto+Sans+Kannada&family=Noto+Sans+Malayalam&family=Noto+Sans+Bengali&family=Noto+Sans+Gujarati&family=Noto+Sans+Gurmukhi&family=Noto+Sans+Oriya&family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Noto+Serif+Devanagari&family=Noto+Serif+Tamil:ital@0;1&family=Noto+Serif+Telugu&family=Noto+Serif+Kannada&family=Noto+Serif+Malayalam&family=Noto+Serif+Bengali&family=Noto+Serif+Gujarati&family=Noto+Serif+Gurmukhi&family=Noto+Serif+Oriya&display=swap" rel="stylesheet">
        <style>
          /* Statically-instanced (non-variable) copies of this export's own fonts, embedded
             as data: URIs — see embed-fonts.ts for why: Chromium's print/PDF-to-file font
             subsetter has known bugs mishandling GPOS/GSUB (glyph positioning/substitution —
             required for correct Indic conjunct/vowel-sign shaping) on *variable* fonts
             specifically, even though the same font shapes perfectly on-screen. The Google
             Fonts <link> above only serves variable Indic-script families, so without this,
             a style that needs one (e.g. Traditional's Noto Serif Tamil) renders correctly in
             the on-screen preview but comes out garbled the moment it's actually printed/
             exported to PDF. Declared after the <link> so these take cascade precedence for
             the same family/weight/style. */
          ${embeddedFontFaceCss}
        </style>
        <style>
          /* Layout-neutral part only — the two cover layouts (.print-cover-centered /
             .print-cover-corners) come from the style, so they live in print-adapter.ts. */
          .print-cover-page {
            page-break-after: always;
            box-sizing: border-box;
          }
          ${styleToPrintCss(style, pageFormat)}

          /* Interface / buttons */
          .print-btn-bar {
            text-align: right;
            margin-bottom: 20px;
          }
          .print-btn {
            background: #0a5c6a;
            color: white;
            border: none;
            padding: 8px 16px;
            font-size: 13px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
          }
          .print-btn:hover {
            background: #084954;
          }

          /* Watermark, from frontmatter's watermark: field. position: fixed repeats
             it on every printed page in Chromium's print/print-to-pdf engine (including
             WebView2, used for the native Windows PDF export) -- the same trick the live
             editor's .cs-watermark uses to stay visible while scrolling. */
          .print-watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 60pt;
            font-weight: 700;
            color: rgba(0, 0, 0, 0.08);
            white-space: nowrap;
            pointer-events: none;
            z-index: -1;
          }

          @media print {
            .print-btn-bar { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-btn-bar">
          <button class="print-btn" onclick="window.print()">Export to PDF / Print</button>
        </div>
        ${watermarkHtml}
        ${coverPageHtml}
        <div id="print-pages"></div>
        <div id="print-flow">${bodyHtml}</div>
        ${printPaginatorScript({
          contentHeightPx: Math.round((pageHeightIn - style.page.marginTopIn - style.page.marginBottomIn) * CSS_PX_PER_IN),
          pageNumberPrefix: 'p',
          continuedSuffix: 'CONTINUED:',
        })}
      </body>
    </html>
  `
}

