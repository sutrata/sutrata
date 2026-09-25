import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  PageBreak,
  WidthType,
  TabStopType,
  LineRuleType,
  Header,
  PageNumber,
} from 'docx'
import type { DocumentNode, ContentNode, InlineSpan } from '@sutrata/parser'
import { resolveStyle } from '../styles/registry'
import { styleToDocxParagraphStyles } from '../styles/docx-adapter'
import { SCRIPT_UNICODE_RANGES } from '../styles/script-ranges'
import { DEFAULT_COVER_LAYOUT } from '../styles/types'
import type { ScreenplayStyleDefinition, CoverElementKey } from '../styles/types'
import { sceneNumberOf, isOmitted } from './scene-number'

interface TextRunProps {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

/** Flatten inline span trees into flat formatting runs. `skipNotes` drops inline
 *  `[[ ]]` note spans entirely (see the "Skip notes" export option). */
function flattenSpans(
  spans: InlineSpan[],
  props: { bold?: boolean; italic?: boolean; underline?: boolean } = {},
  skipNotes = false,
): TextRunProps[] {
  const result: TextRunProps[] = []
  for (const s of spans) {
    if (s.type === 'text') {
      result.push({ text: s.text, ...props })
    } else if (s.type === 'bold') {
      result.push(...flattenSpans(s.spans, { ...props, bold: true }, skipNotes))
    } else if (s.type === 'italic') {
      result.push(...flattenSpans(s.spans, { ...props, italic: true }, skipNotes))
    } else if (s.type === 'underline') {
      result.push(...flattenSpans(s.spans, { ...props, underline: true }, skipNotes))
    } else if (s.type === 'note') {
      if (skipNotes) continue
      // Matches whole-line note styling (italic, brackets kept visible).
      result.push({ text: `[[ ${s.text} ]]`, ...props, italic: true })
    }
  }
  return result
}

const SCRIPT_RANGES: { code: string; re: RegExp }[] = Object.entries(SCRIPT_UNICODE_RANGES).map(
  ([code, re]) => ({ code, re })
)
const SCRIPT_FONT_BY_LANG: Record<string, string> = {
  hi: 'Noto Sans Devanagari', ta: 'Noto Sans Tamil', te: 'Noto Sans Telugu',
  kn: 'Noto Sans Kannada', ml: 'Noto Sans Malayalam', bn: 'Noto Sans Bengali',
  gu: 'Noto Sans Gujarati', pa: 'Noto Sans Gurmukhi', or: 'Noto Sans Oriya',
  si: 'Noto Sans Sinhala',
}

/** Which complex-script lang code (if any) a run's text belongs to \u2014 the shared key
 *  space for both `complexScriptFontOverrides` and `italicScripts`. Unicode presence
 *  wins over `defaultLang` (mixed-script documents), matching getComplexFont's
 *  original priority.
 *
 *  The `defaultLang` fallback (for text with no script-specific characters at all,
 *  e.g. bare punctuation/numbers between Indic words) must never fire for text that
 *  contains actual Latin letters \u2014 otherwise a document with `lang: ta` would treat
 *  every English word (scene headings, "EXT.", character extensions, a plain title)
 *  as Tamil too, which for most styles is a harmless font substitution (Noto Sans/
 *  Serif Tamil both ship full Latin glyphs) but is actively wrong once a style forces
 *  italics for that script (Traditional) \u2014 English text would come out italicized
 *  for no reason. */
function matchScriptCode(text: string, defaultLang: string = 'en'): string | null {
  for (const { code, re } of SCRIPT_RANGES) {
    if (re.test(text)) return code
  }
  if (/[A-Za-z]/.test(text)) return null
  return defaultLang in SCRIPT_FONT_BY_LANG ? defaultLang : null
}

/** Resolve a complex-script font override for a matched script code. Returns null when
 *  the text needs no override (plain Latin) \u2014 never a specific "Latin font" name, since
 *  that decision belongs to the active style's fontFamily (applied at the paragraph-style
 *  level). `overrides` is a style's optional `complexScriptFontOverrides` (e.g.
 *  Traditional's Tamil -> Noto Serif Tamil) \u2014 DOCX runs can only ever name one font,
 *  unlike a CSS font stack, so a style whose body font *does* cover a script it cares
 *  about must say so explicitly here rather than relying on per-glyph fallback like the
 *  editor/print CSS do. */
function getComplexFont(code: string | null, overrides?: Record<string, string>): string | null {
  if (!code) return null
  return overrides?.[code] ?? SCRIPT_FONT_BY_LANG[code] ?? null
}

/** Generate docx TextRun list with correct font mapping. `italicScripts` (a style's
 *  per-script "italic is this script's standard look here" list, e.g. Traditional's
 *  Tamil) forces italics regardless of the run's own markup or `forceItalics` \u2014 matches
 *  the editor's `.cs-force-italic-<code>` behavior. */
function createRuns(
  runProps: TextRunProps[],
  defaultLang: string,
  forceItalics = false,
  complexScriptFontOverrides?: Record<string, string>,
  italicScripts?: string[],
): TextRun[] {
  return runProps.map(r => {
    const code = matchScriptCode(r.text, defaultLang)
    const csFont = getComplexFont(code, complexScriptFontOverrides)
    const scriptForcesItalic = code !== null && (italicScripts?.includes(code) ?? false)
    const runOptions: any = {
      text: r.text,
      bold: r.bold,
      italics: r.italic || forceItalics || scriptForcesItalic,
      underline: r.underline ? {} : undefined,
    }

    // Only set font override for Indic scripts to support proper rendering,
    // leaving latin/general characters to use the paragraph style's own font.
    if (csFont) {
      runOptions.font = {
        ascii: csFont,
        hAnsi: csFont,
        cs: csFont,
        eastAsia: csFont,
      }
    }

    return new TextRun(runOptions)
  })
}

/** Vertical placement of the 'corners' cover, as fractions of the printable page height:
 *  where the title block starts and where the bottom-right date/contact block starts.
 *  Matches print-adapter.ts's .print-cover-corners padding (20% top / block sitting ~6%
 *  above the bottom edge), so the DOCX and PDF covers land in the same place. */
const COVER_CORNERS_TOP_FRACTION = 0.22
const COVER_CORNERS_BOTTOM_FRACTION = 0.78

/** DOCX has no way to anchor a block to the bottom of a page, so the corner cover is
 *  positioned by stacking empty paragraphs of an exact, known height (rather than
 *  Normal-styled blank ones, whose height depends on the reader's default font). */
const COVER_SPACER_TWIPS = 240 // 12pt

/** Height budgeted per date/contact line — their run sizes (10pt/11pt) plus leading. */
const COVER_CONTACT_LINE_TWIPS = 280

/** Enough exact-height spacers to cover `twips` (never negative — a block that already
 *  overshoots its target simply gets none). */
function spacerParagraphs(twips: number): Paragraph[] {
  const count = Math.max(0, Math.round(twips / COVER_SPACER_TWIPS))
  return Array.from({ length: count }, () => new Paragraph({
    spacing: { before: 0, after: 0, line: COVER_SPACER_TWIPS, lineRule: LineRuleType.EXACT },
  }))
}

/** Approximate rendered height of a run of cover paragraphs, from their style's font
 *  sizes and spacing. Approximate is enough: it only decides how many spacers separate
 *  the two corner blocks, and the bottom block's placement is clamped so an
 *  underestimate can't push it onto a second page. Assumes each element occupies one
 *  line — a title or logline long enough to wrap just rides slightly lower. */
function estimateBlockHeightTwips(style: ScreenplayStyleDefinition, keys: CoverElementKey[]): number {
  return keys.reduce((sum, key) => {
    const el = style.elements[key]
    return sum + Math.round(el.fontSizePt * 1.15 * 20) + Math.round((el.spaceBeforePt ?? 0) * 20)
      + Math.round((el.spaceAfterPt ?? 0) * 20)
  }, 0)
}

/** Main exporter function. `styleOverride` picks a style id for this export only
 *  (without touching the document); otherwise the document's frontmatter `style:`
 *  field is used, falling back to the default style. `customStyles` is the list of
 *  user-imported styles loaded from IndexedDB (see file/storage.ts). `skipNotes` omits
 *  both block-level and inline `[[ ]]` notes from the exported document. */
export async function exportToDocx(
  ast: DocumentNode,
  styleOverride?: string,
  customStyles: ScreenplayStyleDefinition[] = [],
  skipNotes = false,
): Promise<Blob> {
  const frontmatter = ast.frontmatter?.data as Record<string, unknown> | undefined
  const defaultLang = (frontmatter?.['lang'] as string) ?? 'en'
  const style = resolveStyle(styleOverride ?? (frontmatter?.['style'] as string | undefined), customStyles)
  const bodyFont = style.fontFamily
  const runsFor = (props: TextRunProps[], forceItalics = false) =>
    createRuns(props, defaultLang, forceItalics, style.complexScriptFontOverrides, style.italicScripts)
  const pageFormat = (frontmatter?.['page'] as string)?.toLowerCase() ?? 'letter'
  const pageWidthTwips = pageFormat === 'a4' ? 11906 : 12240
  const pageHeightTwips = pageFormat === 'a4' ? 16838 : 15840
  const pageMarginLeftTwips = Math.round(style.page.marginLeftIn * 1440)
  const pageMarginRightTwips = Math.round(style.page.marginRightIn * 1440)
  const pageMarginTopTwips = Math.round(style.page.marginTopIn * 1440)
  const pageMarginBottomTwips = Math.round(style.page.marginBottomIn * 1440)
  // Right edge of the printable area, measured from the page margin — where
  // a scene number's right-aligned tab stop should land (matches the UI's
  // right-aligned scene-number box, no leading "#").
  const contentRightEdgeTwips = pageWidthTwips - pageMarginLeftTwips - pageMarginRightTwips

  const childrenNodes: (Paragraph | Table)[] = []

  const hasCover = Boolean(frontmatter && (frontmatter['title'] || frontmatter['author']))

  // 1. Cover Page (if frontmatter has title)
  if (hasCover && frontmatter) {
    const titleText = String(frontmatter['title'] || 'Untitled')
    const authorText = String(frontmatter['author'] || '')
    const loglineText = String(frontmatter['logline'] || '')
    const dateText = String(frontmatter['date'] || '')
    const contactText = String(frontmatter['contact'] || '')

    const titlePara = new Paragraph({
      style: 'CineTitle',
      children: runsFor([{ text: titleText.toUpperCase(), bold: true }]),
    })
    const loglineParas = loglineText
      ? loglineText.split('\n').map(line => new Paragraph({
          style: 'CineLogline',
          children: runsFor([{ text: line, italic: true }]),
        }))
      : []
    // Deliberately not the author style: these mirror the PDF cover's small gray
    // date/contact lines (.print-cover-date / .print-cover-contact), not the
    // author's display size.
    const dateRun = (indent?: number) => new Paragraph({
      alignment: indent === undefined ? AlignmentType.CENTER : undefined,
      indent: indent === undefined ? undefined : { left: indent },
      children: [new TextRun({ text: dateText, font: bodyFont, size: 20, color: '777777' })],
    })
    const contactRuns = (indent?: number) => contactText.split('\n').map(line => new Paragraph({
      alignment: indent === undefined ? AlignmentType.CENTER : undefined,
      indent: indent === undefined ? undefined : { left: indent },
      children: [new TextRun({ text: line, font: bodyFont, size: 22, color: '888888' })],
    }))

    if ((style.coverLayout ?? DEFAULT_COVER_LAYOUT) === 'corners') {
      // Title / "by <author>" / logline flush top-left, date + contact in the
      // bottom-right corner — the PDF cover's .print-cover-corners layout, rebuilt
      // out of the only vertical tool DOCX gives us: exact-height spacer paragraphs
      // (see spacerParagraphs) counted off against the printable page height.
      const contentHeightTwips = pageHeightTwips - pageMarginTopTwips - pageMarginBottomTwips
      const topBlock = [
        titlePara,
        ...(authorText ? [new Paragraph({
          style: 'CineAuthor',
          children: runsFor([{ text: `by ${authorText}` }]),
        })] : []),
        ...loglineParas,
      ]
      const bottomIndent = Math.round(contentRightEdgeTwips * 0.55)
      const bottomBlock = [
        ...(dateText ? [dateRun(bottomIndent)] : []),
        ...(contactText ? contactRuns(bottomIndent) : []),
      ]

      const topOffsetTwips = Math.round(contentHeightTwips * COVER_CORNERS_TOP_FRACTION)
      const topSpacers = spacerParagraphs(topOffsetTwips)
      childrenNodes.push(...topSpacers, ...topBlock)

      // Fill down to the bottom block's target, but never past the point where the
      // block itself would no longer fit — an overshoot would spill the corner onto
      // a second cover page.
      const usedTwips = topSpacers.length * COVER_SPACER_TWIPS
        + estimateBlockHeightTwips(style, ['title', ...(authorText ? ['author' as const] : []), ...loglineParas.map(() => 'logline' as const)])
      const bottomHeightTwips = bottomBlock.length * COVER_CONTACT_LINE_TWIPS
      const bottomTopTwips = Math.min(
        Math.round(contentHeightTwips * COVER_CORNERS_BOTTOM_FRACTION),
        contentHeightTwips - bottomHeightTwips,
      )
      childrenNodes.push(...spacerParagraphs(bottomTopTwips - usedTwips), ...bottomBlock)
    } else {
      for (let k = 0; k < 12; k++) {
        childrenNodes.push(new Paragraph({ text: '' }))
      }

      childrenNodes.push(titlePara)

      childrenNodes.push(new Paragraph({ text: '' }))
      childrenNodes.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'by', font: bodyFont, size: 24 /* 12pt */ })],
        })
      )
      childrenNodes.push(new Paragraph({ text: '' }))

      childrenNodes.push(
        new Paragraph({
          style: 'CineAuthor',
          children: runsFor([{ text: authorText }]),
        })
      )

      if (loglineParas.length > 0) {
        for (let k = 0; k < 6; k++) childrenNodes.push(new Paragraph({ text: '' }))
        childrenNodes.push(...loglineParas)
      }

      if (dateText) {
        for (let k = 0; k < 10; k++) childrenNodes.push(new Paragraph({ text: '' }))
        childrenNodes.push(dateRun())
      }

      if (contactText) {
        if (!dateText) {
          for (let k = 0; k < 10; k++) childrenNodes.push(new Paragraph({ text: '' }))
        } else {
          childrenNodes.push(new Paragraph({ text: '' }))
          childrenNodes.push(new Paragraph({ text: '' }))
        }
        childrenNodes.push(...contactRuns())
      }
    }

    childrenNodes.push(new Paragraph({ children: [new PageBreak()] }))
  }

  // Helper to process standard scene content node and return array of docx components
  function processNode(n: ContentNode): (Paragraph | Table)[] {
    if (n.type === 'action') {
      const runs = runsFor(flattenSpans(n.spans, {}, skipNotes))
      return [
        new Paragraph({
          style: 'CineAction',
          children: runs,
        }),
      ]
    }

    if (n.type === 'character') {
      const charName = n.name.toUpperCase()
      const ext = n.extension ? ` ${n.extension.toUpperCase()}` : ''
      const headText = `${charName}${ext}`
      const runs = runsFor([{ text: headText, bold: true }])

      const result: (Paragraph | Table)[] = [
        new Paragraph({
          style: 'CineCharacter',
          children: runs,
        }),
      ]

      for (const c of n.children) {
        if (c.type === 'parenthetical') {
          const pText = `(${c.text})`
          result.push(
            new Paragraph({
              style: 'CineParenthetical',
              children: runsFor([{ text: pText }]),
            })
          )
        } else {
          const dialogueRuns = runsFor(flattenSpans(c.spans, {}, skipNotes))
          result.push(
            new Paragraph({
              style: 'CineDialogue',
              children: dialogueRuns,
            })
          )
        }
      }
      return result
    }

    if (n.type === 'transition') {
      const transText = n.text.toUpperCase()
      return [
        new Paragraph({
          style: 'CineTransition',
          children: runsFor([{ text: transText }]),
        }),
      ]
    }

    if (n.type === 'centered') {
      return [
        new Paragraph({
          style: 'CineCentered',
          children: runsFor([{ text: n.text }]),
        }),
      ]
    }

    if (n.type === 'lyrics') {
      const runs = runsFor(flattenSpans(n.spans, {}, skipNotes), true)
      return [
        new Paragraph({
          style: 'CineLyrics',
          children: runs,
        }),
      ]
    }

    if (n.type === 'note') {
      if (skipNotes) return []
      const noteText = `[[ ${n.text} ]]`
      return [
        new Paragraph({
          style: 'CineNote',
          children: runsFor([{ text: noteText, italic: true }]),
        }),
      ]
    }

    if (n.type === 'comment') {
      const commentText = `<!-- ${n.text} -->`
      return [
        new Paragraph({
          style: 'CineComment',
          children: runsFor([{ text: commentText, italic: true }]),
        }),
      ]
    }

    if (n.type === 'page-break') {
      return [new Paragraph({ children: [new PageBreak()] })]
    }

    if (n.type === 'dual-dialogue') {
      const leftParas: Paragraph[] = []
      const leftChar = n.left
      const leftRuns = runsFor([{ text: `${leftChar.name.toUpperCase()}${leftChar.extension ? ` ${leftChar.extension.toUpperCase()}` : ''}`, bold: true }])
      leftParas.push(new Paragraph({ style: 'CineCharacter', children: leftRuns }))
      for (const c of leftChar.children) {
        if (c.type === 'parenthetical') {
          leftParas.push(new Paragraph({ style: 'CineParenthetical', children: runsFor([{ text: `(${c.text})` }]) }))
        } else {
          leftParas.push(
            new Paragraph({
              style: 'CineDialogue',
              children: runsFor(flattenSpans(c.spans, {}, skipNotes)),
            })
          )
        }
      }

      const rightParas: Paragraph[] = []
      const rightChar = n.right
      const rightRuns = runsFor([{ text: `${rightChar.name.toUpperCase()}${rightChar.extension ? ` ${rightChar.extension.toUpperCase()}` : ''}`, bold: true }])
      rightParas.push(new Paragraph({ style: 'CineCharacter', children: rightRuns }))
      for (const c of rightChar.children) {
        if (c.type === 'parenthetical') {
          rightParas.push(new Paragraph({ style: 'CineParenthetical', children: runsFor([{ text: `(${c.text})` }]) }))
        } else {
          rightParas.push(
            new Paragraph({
              style: 'CineDialogue',
              children: runsFor(flattenSpans(c.spans, {}, skipNotes)),
            })
          )
        }
      }

      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: leftParas,
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: rightParas,
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
              ],
            }),
          ],
        }),
      ]
    }

    return []
  }

  // Iterate over children
  for (const node of ast.children) {
    if (node.type === 'section') {
      const sectText = node.text
      childrenNodes.push(
        new Paragraph({
          style: 'CineSection',
          children: runsFor([{ text: sectText, bold: true }]),
        })
      )
      for (const subNode of node.children) {
        childrenNodes.push(...processNode(subNode))
      }
    } else if (node.type === 'scene-heading') {
      // Scene number: the {#id} (§6.1); an omitted scene prints OMITTED (§7.4).
      const sceneNumber = sceneNumberOf(node)
      const headingRuns = runsFor([{ text: isOmitted(node) ? 'OMITTED' : node.text.toUpperCase(), bold: true }])
      if (sceneNumber) {
        headingRuns.push(
          new TextRun({ text: '\t' }),
          ...runsFor([{ text: sceneNumber, bold: true }])
        )
      }
      childrenNodes.push(
        new Paragraph({
          style: 'CineSceneHeading',
          tabStops: sceneNumber
            ? [{ type: TabStopType.RIGHT, position: contentRightEdgeTwips }]
            : undefined,
          children: headingRuns,
        })
      )
      for (const subNode of node.children) {
        childrenNodes.push(...processNode(subNode))
      }
    } else {
      childrenNodes.push(...processNode(node))
    }
  }

  // Running header: "p<n>" in the top right, as a PAGE field so Word keeps it correct as
  // the document is edited. The PDF export's other header cell — "<scene> CONTINUED:" on a
  // page that opens mid-scene — has no DOCX equivalent: it depends on where the page break
  // falls, and Word neither exposes that to a field nor lets a header vary per page within
  // a section. (Only the cover is special-cased, via titlePage below.)
  const runningHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            children: ['p', PageNumber.CURRENT],
            font: bodyFont,
            size: Math.round(style.elements.action.fontSizePt * 2),
            italics: true,
          }),
        ],
      }),
    ],
  })

  // Create document with screenplay styles driven by the resolved ScreenplayStyleDefinition
  const doc = new Document({
    styles: {
      paragraphStyles: styleToDocxParagraphStyles(style, contentRightEdgeTwips),
    },
    sections: [
      {
        properties: {
          // The cover takes Word's "different first page" header (an empty one) and page
          // number 0, so the first page of the script itself comes out as p1.
          titlePage: hasCover,
          page: {
            size: {
              width: pageWidthTwips,
              height: pageHeightTwips,
            },
            margin: {
              top: pageMarginTopTwips,
              bottom: pageMarginBottomTwips,
              left: pageMarginLeftTwips,
              right: pageMarginRightTwips,
            },
            pageNumbers: hasCover ? { start: 0 } : undefined,
          },
        },
        headers: {
          default: runningHeader,
          ...(hasCover ? { first: new Header({ children: [new Paragraph({ text: '' })] }) } : {}),
        },
        children: childrenNodes,
      },
    ],
  })

  return Packer.toBlob(doc)
}
