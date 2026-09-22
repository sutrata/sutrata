import type { ScreenplayStyleDefinition, ElementStyle } from './types.js'
import { MIN_ORPHAN_WIDOW_LINES } from './pagination.js'

function color(el: ElementStyle): string {
  return el.color ? `#${el.color}` : 'black'
}

function fontProps(el: ElementStyle): string {
  const lines = [`font-size: ${el.fontSizePt}pt;`, `color: ${color(el)};`]
  if (el.bold) lines.push('font-weight: bold;')
  if (el.italic) lines.push('font-style: italic;')
  if (el.underline) lines.push('text-decoration: underline;')
  if (el.align) lines.push(`text-align: ${el.align};`)
  return lines.join('\n            ')
}

/** Screenplay page-break rules for PDF/print — the CSS half of pagination.ts (DOCX gets
 *  the same rules as keepNext/keepLines). `page-break-*` is emitted alongside the modern
 *  `break-*` because print engines are uneven about which spelling they honor. */
const KEEP_WITH_NEXT = `
            break-after: avoid;
            page-break-after: avoid;
            break-inside: avoid;
            page-break-inside: avoid;`
const KEEP_TOGETHER = `
            break-inside: avoid;
            page-break-inside: avoid;`
/** For elements that may legitimately run longer than a page: don't forbid the break,
 *  just refuse to strand one line on either side of it. */
const ORPHAN_WIDOW = `
            orphans: ${MIN_ORPHAN_WIDOW_LINES};
            widows: ${MIN_ORPHAN_WIDOW_LINES};`

function marginProps(el: ElementStyle): string {
  const lines: string[] = []
  if (el.marginLeftPct !== undefined) lines.push(`margin-left: ${el.marginLeftPct}%;`)
  if (el.marginRightPct !== undefined) lines.push(`margin-right: ${el.marginRightPct}%;`)
  lines.push(`margin-top: ${el.spaceBeforePt ?? 0}pt;`)
  lines.push(`margin-bottom: ${el.spaceAfterPt ?? 0}pt;`)
  return lines.join('\n            ')
}

/** Builds the screenplay-specific portion of the PDF/print-preview `<style>` block
 *  (packages/app/src/file/workflow-reports.ts's buildScreenplayPrintHtml) from a style
 *  definition. UI chrome (print button, page-break rule, dual-dialogue column layout)
 *  stays hardcoded in workflow-reports.ts — only the parametrized visual properties live here. */
export function styleToPrintCss(style: ScreenplayStyleDefinition, pageFormat: 'letter' | 'a4' = 'letter'): string {
  const e = style.elements
  const contentWidthIn = (pageFormat === 'a4' ? 8.27 : 8.5) - style.page.marginLeftIn - style.page.marginRightIn
  // The style's own font first, then its explicit per-script overrides (e.g. Traditional's
  // Noto Serif Tamil) so they win over the generic Indic fallback that always follows — this
  // HTML has no per-span language tagging, so one comprehensive stack has to do the work the
  // editor's .cs-lang-* rules split across classes. Overrides are style-specific, so unlike
  // the fixed Noto Sans fallback list they must come from the style itself, not be hardcoded —
  // otherwise every style would render Indic scripts in whatever the *last*-defined style's
  // overrides asked for.
  const overrideFonts = Object.values(style.complexScriptFontOverrides ?? {})
  // Noto Sans comes right after the style's own fonts: it is the Latin fallback (app spec
  // §4.4) and its bundled file carries every ISO 15919 letter and combining mark, which the
  // Indic families' Latin subsets do not. Its unicode-range stops at Latin, so Indic text
  // still falls through to the script-specific faces below.
  const fontStack = [...new Set([
    `'${style.fontFamily}'`,
    ...overrideFonts.map(f => `'${f}'`),
    "'Noto Sans'",
    "'Noto Sans Tamil'", "'Noto Sans Devanagari'", "'Noto Sans Telugu'", "'Noto Sans Kannada'",
    "'Noto Sans Malayalam'", "'Noto Sans Bengali'", "'Noto Sans Gujarati'", "'Noto Sans Gurmukhi'",
    "'Noto Sans Oriya'", 'sans-serif',
  ])].join(', ')
  return `
          @page {
            /* Stated, not left to the print dialog's default: print-paginator.ts fills
               fixed-height page boxes, so the paper it fills them for has to be the paper
               the browser actually prints on (and it's the same page: field the DOCX
               export already honors). */
            size: ${pageFormat === 'a4' ? 'A4' : 'letter'};
            margin: ${style.page.marginTopIn}in ${style.page.marginRightIn}in ${style.page.marginBottomIn}in ${style.page.marginLeftIn}in;
          }
          body {
            font-family: ${fontStack};
            margin: 0;
            padding: 0;
            background: white;
            color: black;
            font-size: 11pt;
          }
          /* Cover layouts — one of these two classes is on .print-cover-page, picked by
             the style's coverLayout (see types.ts). Both wrap the same markup: a
             .print-cover-top block (title / by-line / logline) and a .print-cover-bottom
             block (date / contact). */
          .print-cover-centered {
            height: 80vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }
          .print-cover-corners {
            height: 88vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: left;
          }
          /* Down from the top edge, not glued to it — the reference script starts its
             title roughly a quarter of the way down the page. */
          .print-cover-corners .print-cover-top {
            padding-top: 20%;
          }
          .print-cover-corners .print-cover-bottom {
            align-self: flex-end;
            padding-bottom: 6%;
            max-width: 45%;
          }
          .print-cover-corners .print-cover-logline {
            margin-top: 12pt;
            max-width: 75%;
          }
          /* The corner block is its own visual group: the centered layout's big
             separating margins would push it off the page bottom. */
          .print-cover-corners .print-cover-date,
          .print-cover-corners .print-cover-contact {
            margin-top: 0;
          }
          .print-cover-title {
            ${fontProps(e.title)}
            text-transform: uppercase;
            margin-bottom: 20px;
          }
          .print-cover-by {
            font-size: 12pt;
            margin: 10px 0;
          }
          .print-cover-author {
            ${fontProps(e.author)}
          }
          .print-cover-logline {
            ${fontProps(e.logline)}
            margin-top: 40px;
            max-width: 600px;
            white-space: pre-line;
          }
          .print-cover-date {
            font-size: 10pt;
            margin-top: 50px;
            color: #777;
          }
          .print-cover-contact {
            font-size: 11pt;
            margin-top: 24px;
            color: #888;
            white-space: pre-line;
          }

          /* The preview lays out at exactly the printable width, on screen as well as on
             paper. print-paginator.ts measures where the page breaks fall in the live
             window, so if the on-screen line breaks differed from the printed ones (a
             1280px-wide window wraps far later than a 6in column) every page it filled
             would overflow its sheet when printed. */
          #print-flow, #print-pages, .print-cover-page {
            width: ${contentWidthIn}in;
            margin-left: auto;
            margin-right: auto;
          }

          /* One printed sheet of body content, built by print-paginator.ts: an exact
             page-height box (set inline, from the paper size) so the browser puts exactly
             one on each sheet, with the running header at its top. */
          .print-page {
            break-after: page;
            page-break-after: always;
            box-sizing: border-box;
            overflow: visible;
          }
          .print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .print-page-body {
            position: relative;
            display: flow-root; /* so a first child's margin-top counts inside the page */
          }
          .print-page-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: ${e.action.fontSizePt}pt;
            font-style: italic;
            margin-bottom: 24pt;
          }
          @media screen {
            .print-page {
              border-bottom: 1px dashed #ccc;
              margin-bottom: 24px;
            }
          }

          /* Screenplay items */
          .print-scene-heading {
            ${fontProps(e.sceneHeading)}
            text-transform: uppercase;
            ${marginProps(e.sceneHeading)}
            display: flex;
            justify-content: space-between;${KEEP_WITH_NEXT}
          }
          .print-action {
            ${fontProps(e.action)}
            ${marginProps(e.action)}
            line-height: 1.4;${ORPHAN_WIDOW}
          }
          .print-character-block {
            margin-top: ${e.character.spaceBeforePt ?? 0}pt;
            margin-bottom: ${e.character.spaceAfterPt ?? 0}pt;
          }
          .print-character {
            ${fontProps(e.character)}
            margin-left: ${e.character.marginLeftPct ?? 0}%;
            margin-bottom: 2pt;${KEEP_WITH_NEXT}
          }
          .print-parenthetical {
            ${fontProps(e.parenthetical)}
            margin-left: ${e.parenthetical.marginLeftPct ?? 0}%;
            margin-right: ${e.parenthetical.marginRightPct ?? 0}%;
            margin-bottom: 2pt;${KEEP_WITH_NEXT}
          }
          .print-dialogue {
            ${fontProps(e.dialogue)}
            ${marginProps(e.dialogue)}
            line-height: 1.3;${ORPHAN_WIDOW}
          }
          .print-transition {
            ${fontProps(e.transition)}
            ${marginProps(e.transition)}
            text-transform: uppercase;${KEEP_TOGETHER}
          }
          .print-centered {
            ${fontProps(e.centered)}
            ${marginProps(e.centered)}
          }
          .print-lyrics {
            ${fontProps(e.lyrics)}
            ${marginProps(e.lyrics)}${ORPHAN_WIDOW}
          }
          .print-note {
            background: #fffbeb;
            border-left: 2px solid #d97706;
            padding: 4px 8px;
            ${fontProps(e.note)}
            ${marginProps(e.note)}
          }
          .print-comment {
            ${fontProps(e.comment)}
            ${marginProps(e.comment)}
          }
          .print-section {
            ${fontProps(e.section)}
            ${marginProps(e.section)}${KEEP_WITH_NEXT}
          }
          .print-page-break {
            page-break-after: always;
          }

          /* Dual dialogue */
          .print-dual-dialogue {
            display: flex;
            margin-top: 6pt;
            margin-bottom: 6pt;
          }
          .print-dual-column {
            flex: 1;
            min-width: 0;
          }
          .print-left-column {
            margin-right: 20px;
          }
          .print-right-column {
            margin-left: 20px;
          }
          .print-dual-column .print-character {
            margin-left: 10%;
          }
          .print-dual-column .print-parenthetical,
          .print-dual-column .print-dialogue {
            margin-left: 10%;
            margin-right: 5%;
          }`
}
