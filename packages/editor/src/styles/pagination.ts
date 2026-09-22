import type { BodyElementKey } from './types.js'

/** Screenplay pagination rules — format conventions, not per-style visual choices, so
 *  they live here rather than in ScreenplayStyleDefinition: no style (built-in or
 *  user-imported) gets to end a page on a character cue. Consumed by both export
 *  paths, which express the same rule differently: DOCX via `keepNext`/`keepLines`
 *  paragraph properties (docx-adapter.ts), PDF/print via `break-after`/`break-inside`
 *  (print-adapter.ts). The live editor has no pagination, so it ignores these. */

/** Elements that must not be the last thing on a page — a scene heading or character
 *  cue stranded at the bottom with its action/dialogue overleaf is the classic
 *  screenplay pagination error. A parenthetical is included for the same reason: it
 *  belongs to the dialogue line that follows it. */
export const KEEP_WITH_NEXT_ELEMENTS: readonly BodyElementKey[] = [
  'sceneHeading', 'character', 'parenthetical', 'section',
]

/** Elements short enough that splitting them across a page boundary is always wrong.
 *  Deliberately excludes action/dialogue/lyrics/note — those can legitimately run
 *  longer than a page, so they get orphan/widow control instead of an unbreakable box. */
export const KEEP_TOGETHER_ELEMENTS: readonly BodyElementKey[] = [
  'sceneHeading', 'character', 'parenthetical', 'transition', 'section',
]

/** Minimum lines of a breakable element left on either side of a page boundary. Two is
 *  the standard screenplay/typography minimum (a single stranded line reads as an error). */
export const MIN_ORPHAN_WIDOW_LINES = 2
