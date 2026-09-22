import { AlignmentType } from 'docx'
import type { IParagraphStyleOptions } from 'docx'
import { BODY_ELEMENT_KEYS, COVER_ELEMENT_KEYS } from './types.js'
import { KEEP_WITH_NEXT_ELEMENTS, KEEP_TOGETHER_ELEMENTS } from './pagination.js'
import type { ScreenplayStyleDefinition, ElementStyle, BodyElementKey, CoverElementKey } from './types.js'

/** Sutra element -> stable docx paragraph style id. Fixed forever: docx-importer.ts
 *  matches re-imported .docx files against these exact ids, regardless of appearance. */
const DOCX_STYLE_IDS: Record<BodyElementKey, string> = {
  sceneHeading: 'CineSceneHeading',
  action: 'CineAction',
  character: 'CineCharacter',
  parenthetical: 'CineParenthetical',
  dialogue: 'CineDialogue',
  transition: 'CineTransition',
  centered: 'CineCentered',
  lyrics: 'CineLyrics',
  section: 'CineSection',
  note: 'CineNote',
  comment: 'CineComment',
}

/** Cover-page element -> docx paragraph style id, referenced by docx-exporter.ts's
 *  title page. These must be emitted alongside the body styles: a paragraph naming a
 *  style the document doesn't define silently falls back to Word's Normal style
 *  (left-aligned 11pt black), which is exactly how the title page used to render. */
const DOCX_COVER_STYLE_IDS: Record<CoverElementKey, string> = {
  title: 'CineTitle',
  author: 'CineAuthor',
  logline: 'CineLogline',
}

const ALIGN_MAP = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
} as const

function pctToTwips(pct: number | undefined, contentWidthTwips: number): number | undefined {
  if (pct === undefined) return undefined
  return Math.round((pct / 100) * contentWidthTwips)
}

/** docx's *style-level* paragraph options type omits `widowControl`, but the paragraph-
 *  property serializer it shares with `Paragraph` does emit it (verified: `<w:widowControl/>`
 *  lands in the generated word/styles.xml). Widen the type rather than drop the property. */
type StyleParagraphOptions = NonNullable<IParagraphStyleOptions['paragraph']> & { widowControl?: boolean }

/** `pagination` carries the screenplay page-break rules for body elements (see
 *  pagination.ts); cover-page elements pass none — a cover page is one page by
 *  construction. */
function elementToDocxStyle(
  id: string,
  el: ElementStyle,
  fontFamily: string,
  contentWidthTwips: number,
  pagination: { keepNext?: boolean; keepLines?: boolean } = {},
): IParagraphStyleOptions {
  const left = pctToTwips(el.marginLeftPct, contentWidthTwips)
  const right = pctToTwips(el.marginRightPct, contentWidthTwips)
  const paragraph: StyleParagraphOptions = {
    alignment: el.align ? ALIGN_MAP[el.align] : undefined,
    indent: (left !== undefined || right !== undefined) ? { left, right } : undefined,
    spacing: {
      before: el.spaceBeforePt !== undefined ? Math.round(el.spaceBeforePt * 20) : undefined,
      after: el.spaceAfterPt !== undefined ? Math.round(el.spaceAfterPt * 20) : undefined,
    },
    keepNext: pagination.keepNext,
    keepLines: pagination.keepLines,
    // Stated rather than left to Word's default: action/dialogue stay breakable
    // (no keepLines), so widow control is what stops a page break from stranding a
    // single line of them on either side.
    widowControl: true,
  }
  return {
    id,
    name: id,
    run: {
      font: fontFamily,
      size: Math.round(el.fontSizePt * 2),
      bold: el.bold || undefined,
      italics: el.italic || undefined,
      underline: el.underline ? {} : undefined,
      color: el.color,
    },
    paragraph,
  }
}

/** Builds the `paragraphStyles` array for `new Document({ styles: { paragraphStyles } })`
 *  from a style definition. `contentWidthTwips` is the page's printable width (page width
 *  minus left+right margins) — percentages are resolved against it, so indentation scales
 *  correctly with page size/margins instead of reusing one page format's fixed twips. */
export function styleToDocxParagraphStyles(
  style: ScreenplayStyleDefinition,
  contentWidthTwips: number,
): IParagraphStyleOptions[] {
  return [
    ...BODY_ELEMENT_KEYS.map(key =>
      elementToDocxStyle(DOCX_STYLE_IDS[key], style.elements[key], style.fontFamily, contentWidthTwips, {
        keepNext: KEEP_WITH_NEXT_ELEMENTS.includes(key) || undefined,
        keepLines: KEEP_TOGETHER_ELEMENTS.includes(key) || undefined,
      })
    ),
    ...COVER_ELEMENT_KEYS.map(key =>
      elementToDocxStyle(DOCX_COVER_STYLE_IDS[key], style.elements[key], style.fontFamily, contentWidthTwips)
    ),
  ]
}
