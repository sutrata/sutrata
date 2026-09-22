import type { ScreenplayStyleDefinition } from './types.js'
import { DEFAULT_STYLE_ID } from './types.js'
import { BUILTIN_STYLES, getBuiltinStyle } from './builtin-styles.js'

/** Resolves a style id (usually from frontmatter's `style:` field) to a definition.
 *  Falls back to the default style when the id is missing or unrecognized — e.g. a
 *  document referencing a custom style the current machine/browser hasn't imported. */
export function resolveStyle(
  id: string | undefined,
  customStyles: ScreenplayStyleDefinition[],
): ScreenplayStyleDefinition {
  const wanted = id ?? DEFAULT_STYLE_ID
  return getBuiltinStyle(wanted)
    ?? customStyles.find(s => s.id === wanted)
    ?? getBuiltinStyle(DEFAULT_STYLE_ID)!
}

export function allStyles(customStyles: ScreenplayStyleDefinition[]): ScreenplayStyleDefinition[] {
  return [...BUILTIN_STYLES, ...customStyles]
}
