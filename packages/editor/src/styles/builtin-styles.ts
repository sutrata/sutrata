import type { ScreenplayStyleDefinition } from './types.js'
import { DEFAULT_STYLE_ID } from './types.js'

/**
 * The app's long-standing default look, extracted from the values that were
 * hardcoded across screenplay.css / docx-exporter.ts / workflow-reports.ts
 * before those three were unified onto this shared definition. Where the
 * three disagreed (they had drifted — see the multi-style implementation
 * plan), the live editor's CSS is treated as canonical for font-size/color/
 * margin-%, so the editor's appearance is unchanged; DOCX/PDF absorb the
 * (small, confirmed) corrections needed to match it.
 */
export const CLASSIC_STYLE: ScreenplayStyleDefinition = {
  id: 'classic',
  name: 'Classic',
  description: 'The original Sutrata look — teal scene headings, rust character cues.',
  fontFamily: 'Noto Sans',
  page: { marginTopIn: 1, marginBottomIn: 1, marginLeftIn: 1, marginRightIn: 1 },
  elements: {
    sceneHeading: { fontSizePt: 13, bold: true, color: '0A5C6A', marginLeftPct: 10, marginRightPct: 8, spaceBeforePt: 13, spaceAfterPt: 7.2 },
    action: { fontSizePt: 12, marginLeftPct: 10, marginRightPct: 8, spaceBeforePt: 6, spaceAfterPt: 7.2 },
    character: { fontSizePt: 13, bold: true, color: '9C4221', marginLeftPct: 17, spaceBeforePt: 6.5, spaceAfterPt: 0 },
    parenthetical: { fontSizePt: 13, marginLeftPct: 17, marginRightPct: 20, spaceAfterPt: 0 },
    dialogue: { fontSizePt: 12, marginLeftPct: 17, marginRightPct: 17, spaceAfterPt: 7.2 },
    transition: { fontSizePt: 13, align: 'right', marginRightPct: 8, spaceBeforePt: 6.5, spaceAfterPt: 7.2 },
    centered: { fontSizePt: 13, align: 'center', spaceBeforePt: 6.5, spaceAfterPt: 7.2 },
    lyrics: { fontSizePt: 13, italic: true, marginLeftPct: 10, marginRightPct: 8, spaceAfterPt: 3.6 },
    section: { fontSizePt: 14, bold: true, color: '6F6F6F', marginLeftPct: 10, spaceBeforePt: 21, spaceAfterPt: 7.2 },
    note: { fontSizePt: 10, color: '7A6000', marginLeftPct: 10, marginRightPct: 8, spaceAfterPt: 3.6 },
    comment: { fontSizePt: 10, color: 'AAAAAA', italic: true, marginLeftPct: 10, spaceAfterPt: 3.6 },
    title: { fontSizePt: 24, bold: true, color: '0A5C6A', align: 'center', spaceAfterPt: 14.4 },
    author: { fontSizePt: 16, align: 'center', spaceAfterPt: 7.2 },
    logline: { fontSizePt: 12, italic: true, color: '555555', align: 'center', spaceAfterPt: 7.2 },
  },
}

/**
 * A second built-in style with a genuinely different look — monospace,
 * monochrome (no `color` on any element, exercising the fallback-to-black
 * path), industry-standard flush-left margins — to prove the architecture
 * isn't secretly hardcoded to CLASSIC_STYLE's shape.
 */
export const INDUSTRY_COURIER_STYLE: ScreenplayStyleDefinition = {
  id: 'industry-courier',
  name: 'Industry Courier',
  description: 'Monospace, monochrome, flush-left margins — the classic spec-script look.',
  fontFamily: 'Courier Prime',
  page: { marginTopIn: 1, marginBottomIn: 1, marginLeftIn: 1.5, marginRightIn: 1 },
  elements: {
    sceneHeading: { fontSizePt: 12, bold: true, spaceBeforePt: 24, spaceAfterPt: 12 },
    action: { fontSizePt: 12, spaceBeforePt: 12, spaceAfterPt: 12 },
    character: { fontSizePt: 12, bold: true, marginLeftPct: 30, spaceBeforePt: 12, spaceAfterPt: 0 },
    parenthetical: { fontSizePt: 12, marginLeftPct: 26, marginRightPct: 15, spaceAfterPt: 0 },
    dialogue: { fontSizePt: 12, marginLeftPct: 20, marginRightPct: 15, spaceAfterPt: 12 },
    transition: { fontSizePt: 12, align: 'right', spaceBeforePt: 12, spaceAfterPt: 12 },
    centered: { fontSizePt: 12, align: 'center', spaceBeforePt: 12, spaceAfterPt: 12 },
    lyrics: { fontSizePt: 12, italic: true, spaceAfterPt: 6 },
    section: { fontSizePt: 12, bold: true, spaceBeforePt: 24, spaceAfterPt: 12 },
    note: { fontSizePt: 10, spaceAfterPt: 6 },
    comment: { fontSizePt: 10, italic: true, spaceAfterPt: 6 },
    title: { fontSizePt: 24, bold: true, align: 'center', spaceAfterPt: 14.4 },
    author: { fontSizePt: 16, align: 'center', spaceAfterPt: 7.2 },
    logline: { fontSizePt: 12, italic: true, align: 'center', spaceAfterPt: 7.2 },
  },
}

/** Every Indic script Sutrata already self-hosts Noto Sans for, pointed at its Noto
 *  Serif equivalent instead (all bundled in shell/fonts/fonts.css the same way as Noto
 *  Sans — see fonts-serif-block.css generation notes in that file's history). Reused by
 *  TRADITIONAL_STYLE's `complexScriptFontOverrides`: Noto Serif was chosen over the
 *  originally-considered Vijaya specifically because it already covers every script
 *  Noto Sans does and carries an OFL license, so — unlike Vijaya — it can actually ship
 *  in the repo instead of depending on the reader's OS/Word already having it installed. */
const NOTO_SERIF_COMPLEX_SCRIPT_FONTS: Record<string, string> = {
  hi: 'Noto Serif Devanagari', ta: 'Noto Serif Tamil', te: 'Noto Serif Telugu',
  kn: 'Noto Serif Kannada', ml: 'Noto Serif Malayalam', bn: 'Noto Serif Bengali',
  gu: 'Noto Serif Gujarati', pa: 'Noto Serif Gurmukhi', or: 'Noto Serif Oriya',
  si: 'Noto Serif Sinhala',
}

/**
 * Modeled on a real Tamil feature screenplay PDF (betterfountain/Fountain export):
 * bold scene headings, underlined (not bold) character cues, fully monochrome,
 * flush-left action/scene headings, A4 with 1in margins all around.
 * Measurements (font sizes, indents as % of content width) were taken
 * directly from the PDF's text positions; elements the reference document
 * doesn't print at all (section/note/comment — Fountain strips these from
 * output) are extrapolated to match its scale rather than measured.
 *
 * The reference PDF actually used Vijaya, a proprietary Microsoft font — not
 * bundled here (unlike Noto, it can't legally ship in the repo, and depending
 * on the reader's OS/Word already having it installed is a worse default than
 * a font that just works). Noto Serif is the deliberate second choice: not a
 * perfect visual match, but it already has a variant for every script Noto
 * Sans does (so this style isn't just "Tamil-only" the way a Vijaya-based one
 * would be) and ships under the OFL, so it's self-hosted for real instead of
 * hoped-for. Tamil specifically renders in Noto Serif Tamil's *italic* face by
 * default (`italicScripts`, forced even on bold scene headings/sections) since
 * that slant reads closer to Vijaya than the upright serif does — every other
 * script stays upright serif, `italicScripts` only lists 'ta'.
 */
export const TRADITIONAL_STYLE: ScreenplayStyleDefinition = {
  id: 'traditional',
  name: 'Traditional',
  description: 'Bold serif scene headings, underlined cues, italic Tamil — modeled on a real Tamil shooting script.',
  fontFamily: 'Noto Serif',
  complexScriptFontOverrides: NOTO_SERIF_COMPLEX_SCRIPT_FONTS,
  italicScripts: ['ta'],
  // The reference PDF's cover: title / "by <author>" / logline flush top-left,
  // date and contact down in the bottom-right corner.
  coverLayout: 'corners',
  page: { marginTopIn: 1, marginBottomIn: 1, marginLeftIn: 1, marginRightIn: 1 },
  elements: {
    sceneHeading: { fontSizePt: 12, bold: true, spaceBeforePt: 17, spaceAfterPt: 9 },
    action: { fontSizePt: 10, spaceBeforePt: 8, spaceAfterPt: 9 },
    character: { fontSizePt: 10, underline: true, marginLeftPct: 32, spaceBeforePt: 8, spaceAfterPt: 0 },
    parenthetical: { fontSizePt: 10, marginLeftPct: 32, marginRightPct: 20, spaceAfterPt: 0 },
    dialogue: { fontSizePt: 10, marginLeftPct: 24, marginRightPct: 17, spaceAfterPt: 9 },
    transition: { fontSizePt: 10, align: 'right', spaceBeforePt: 9, spaceAfterPt: 9 },
    centered: { fontSizePt: 10, align: 'center', italic: true, spaceBeforePt: 9, spaceAfterPt: 9 },
    lyrics: { fontSizePt: 10, italic: true, spaceAfterPt: 5 },
    section: { fontSizePt: 12, bold: true, spaceBeforePt: 27, spaceAfterPt: 9 },
    note: { fontSizePt: 10, color: '666666', spaceAfterPt: 5 },
    comment: { fontSizePt: 13, italic: true, spaceAfterPt: 5 },
    title: { fontSizePt: 32, bold: true, align: 'left', spaceAfterPt: 16 },
    author: { fontSizePt: 16, align: 'left', spaceAfterPt: 8 },
    logline: { fontSizePt: 10, align: 'left', spaceAfterPt: 8 },
  },
}

export const BUILTIN_STYLES: ScreenplayStyleDefinition[] = [CLASSIC_STYLE, INDUSTRY_COURIER_STYLE, TRADITIONAL_STYLE]

export function getBuiltinStyle(id: string): ScreenplayStyleDefinition | undefined {
  return BUILTIN_STYLES.find(s => s.id === id)
}

export function isBuiltinStyleId(id: string): boolean {
  return id === DEFAULT_STYLE_ID || BUILTIN_STYLES.some(s => s.id === id)
}
