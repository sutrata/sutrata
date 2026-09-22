/** Screenplay body elements that carry a visual style — one entry per docx-exporter.ts
 *  paragraph style / screenplay.css class. Excludes structural/chrome things
 *  (scene metadata, page breaks, parenthetical parens) that aren't stylistic choices. */
export const BODY_ELEMENT_KEYS = [
  'sceneHeading', 'action', 'character', 'parenthetical', 'dialogue',
  'transition', 'centered', 'lyrics', 'section', 'note', 'comment',
] as const
export type BodyElementKey = typeof BODY_ELEMENT_KEYS[number]

/** Cover-page elements. Export-only (DOCX/PDF) — there is no live editor
 *  preview of the cover page today, so these never produce editor CSS vars. */
export const COVER_ELEMENT_KEYS = ['title', 'author', 'logline'] as const
export type CoverElementKey = typeof COVER_ELEMENT_KEYS[number]

export interface ElementStyle {
  fontSizePt: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  /** 6 hex digits, no leading '#' (docx-native shape; CSS adapter adds the '#'). */
  color?: string
  /** Percentage of the printable content width. */
  marginLeftPct?: number
  marginRightPct?: number
  align?: 'left' | 'center' | 'right'
  /** Space before/after the paragraph, in points. DOCX-only: the live editor
   *  only ever applies `spaceBeforePt` (as margin-top); adjacent elements in
   *  the editor create their gap from the *following* element's margin-top,
   *  not from a margin-bottom on the preceding one, so `spaceAfterPt` has no
   *  editor-CSS effect — see css-adapter.ts. */
  spaceBeforePt?: number
  spaceAfterPt?: number
}

export type ScreenplayElements =
  Record<BodyElementKey, ElementStyle> & Record<CoverElementKey, ElementStyle>

/** How the exported cover page arranges its blocks (DOCX + PDF; there is no editor
 *  preview of the cover). 'centered' stacks everything down the middle of the page;
 *  'corners' puts title / "by <author>" / logline flush top-left and date + contact
 *  down in the bottom-right, the arrangement Tamil shooting scripts print. Per-element
 *  font/size/color still come from `elements.title|author|logline` either way — this
 *  chooses the *placement* those elements are laid out in, nothing else. */
export type CoverLayout = 'centered' | 'corners'
export const COVER_LAYOUTS: readonly CoverLayout[] = ['centered', 'corners']
export const DEFAULT_COVER_LAYOUT: CoverLayout = 'centered'

export interface ScreenplayStyleDefinition {
  /** Stable slug: persisted in frontmatter's `style:` field and as the IndexedDB key. */
  id: string
  name: string
  description?: string
  /** Latin body font. For the live editor and PDF/print export this is just the
   *  first entry in a CSS font stack (screenplay.css / print-adapter.ts put
   *  'Noto Sans'/script-specific Noto Sans fonts after it), so the browser's own
   *  per-glyph fallback transparently covers any script this font doesn't have —
   *  no per-style CSS plumbing needed. DOCX has no such per-glyph fallback
   *  (a `w:rFonts` run property names exactly one font), so a style whose body
   *  font *does* cover a non-Latin script it cares about (e.g. Traditional's
   *  Vijaya for Tamil) must say so explicitly via `complexScriptFontOverrides`. */
  fontFamily: string
  /** Per-script font override, keyed by the same lang codes docx-exporter.ts's
   *  getComplexFont switches on ('ta', 'hi', 'te', ...). Omit a script and it keeps
   *  using the shared default (e.g. 'Noto Sans Tamil') — this is an opt-in exception,
   *  not a requirement to theme every script. Consumed by all three renderers:
   *  DOCX (docx-exporter.ts, where it's required — a `w:rFonts` run property names
   *  exactly one font, so there's no per-glyph fallback to lean on), the live editor
   *  (css-adapter.ts turns each entry into a `--cs-lang-<code>-font-family` CSS var
   *  that screenplay.css's `.cs-lang-<code>` rules prefer over the generic Noto Sans
   *  fallback), and PDF/print (print-adapter.ts folds the values into the body font
   *  stack ahead of the generic Indic fallbacks). */
  complexScriptFontOverrides?: Record<string, string>
  /** Lang codes (same set as above) whose *default* presentation is italic under this
   *  style — not "emphasized text happens to be italic", but "upright is not this
   *  script's normal look here" (e.g. Traditional's Tamil, styled after Noto Serif
   *  Tamil Italic to approximate Vijaya's slant). Forces italic even where the
   *  element itself isn't (bold scene headings included) — confirmed as the intended
   *  behavior, not layered underneath per-element italic. DOCX applies this
   *  unconditionally per run; the editor applies it via a `.cs-force-italic-<code>`
   *  class (see EditorView.tsx/css-adapter.ts) rather than a plain CSS var, because a
   *  var would unconditionally set `font-style` and stomp elements that are
   *  legitimately italic for their own reasons (lyrics, comments) on styles that
   *  don't list the script here. PDF/print has no per-span language tagging, so this
   *  has no effect there — a known, documented gap, not an oversight. */
  italicScripts?: string[]
  /** Defaults to DEFAULT_COVER_LAYOUT when a style (or an imported one) omits it. */
  coverLayout?: CoverLayout
  page: {
    marginTopIn: number
    marginBottomIn: number
    marginLeftIn: number
    marginRightIn: number
  }
  elements: ScreenplayElements
}

export const DEFAULT_STYLE_ID = 'classic'

/** Lang codes docx-exporter.ts's getComplexFont / SCRIPT_RANGES recognize — the full
 *  key space for `complexScriptFontOverrides` / `italicScripts`. Iterated by
 *  css-adapter.ts to clear a previous style's per-script vars/classes when switching
 *  to a style that doesn't set them (so nothing lingers). */
export const COMPLEX_SCRIPT_CODES = ['hi', 'ta', 'te', 'kn', 'ml', 'bn', 'gu', 'pa', 'or', 'si'] as const
export type ComplexScriptCode = typeof COMPLEX_SCRIPT_CODES[number]
