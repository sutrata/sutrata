import { BODY_ELEMENT_KEYS, COMPLEX_SCRIPT_CODES } from './types.js'
import type { ScreenplayStyleDefinition, ElementStyle } from './types.js'

function kebab(key: string): string {
  return key.replace(/([A-Z])/g, '-$1').toLowerCase()
}

/**
 * Converts a style into the CSS custom properties screenplay.css reads via
 * `var(--cs-<element>-<prop>, <classic-fallback>)`. Applied to `.cs-editor-mount`
 * so the live editor picks up whichever style the current document (or an
 * explicit override) resolves to — works identically for built-in and
 * user-imported styles since both are plain `ScreenplayStyleDefinition` objects
 * by the time they reach here.
 *
 * Deliberately does NOT emit anything for `spaceAfterPt` — the live editor only
 * ever expresses "space before" via margin-top; adjacent elements form their gap
 * from the *following* element's margin-top, not a margin-bottom on the
 * preceding one (see types.ts). `spaceAfterPt` is DOCX/print-only.
 *
 * A `null` entry means "no override" and must be cleared with `removeProperty`,
 * never `setProperty(k, 'inherit')`: for a CUSTOM property, the literal value
 * `inherit` is a CSS-wide keyword that makes the property itself inherit from
 * *its own* parent (here, .cs-editor-mount's parent, which never defines it) —
 * it does not store the string "inherit" for descendants to read. That breaks
 * inheritance for every element below it, not just the unset one.
 */
export function styleToCssVars(style: ScreenplayStyleDefinition): Record<string, string | null> {
  const vars: Record<string, string | null> = {
    '--cs-body-font-family': style.fontFamily,
  }

  for (const key of BODY_ELEMENT_KEYS) {
    const el: ElementStyle = style.elements[key]
    const prefix = `--cs-${kebab(key)}`
    vars[`${prefix}-font-size`] = `${el.fontSizePt}pt`
    vars[`${prefix}-font-weight`] = el.bold ? 'bold' : 'normal'
    vars[`${prefix}-font-style`] = el.italic ? 'italic' : 'normal'
    vars[`${prefix}-text-decoration`] = el.underline ? 'underline' : 'none'
    vars[`${prefix}-color`] = el.color ? `#${el.color}` : null
    vars[`${prefix}-margin-left`] = `${el.marginLeftPct ?? 0}%`
    vars[`${prefix}-margin-right`] = `${el.marginRightPct ?? 0}%`
    vars[`${prefix}-text-align`] = el.align ?? 'left'
    vars[`${prefix}-margin-top`] = `${el.spaceBeforePt ?? 0}pt`
  }

  // Per-script font override: screenplay.css's .cs-lang-<code> rules prefer this over
  // the generic --cs-body-font-family fallback. Emit `null` for every code the style
  // doesn't override so a previously-applied style's choice can't linger (see
  // applyStyleVars). italicScripts is NOT emitted as a var — see applyStyleVars.
  for (const code of COMPLEX_SCRIPT_CODES) {
    vars[`--cs-lang-${code}-font-family`] = style.complexScriptFontOverrides?.[code] ?? null
  }

  return vars
}

/** Applies every var from `styleToCssVars` onto an element (the `.cs-editor-mount` ref),
 *  clearing any that resolved to `null` so a previous style's value can't linger. Also
 *  toggles a `.cs-force-italic-<code>` class per `style.italicScripts` — a class rather
 *  than a CSS var because `.cs-lang-<code>` rules already exist for lyrics/comments etc.
 *  that are legitimately italic on their own; a `font-style` var on `.cs-lang-<code>`
 *  itself would unconditionally win the cascade and stomp that even for styles that
 *  don't ask for forced italics (see types.ts's `italicScripts` doc for the full
 *  reasoning). The class only ever *adds* specificity to force italic on; it's absent
 *  entirely for scripts/styles that don't want it, so nothing is stomped either way. */
export function applyStyleVars(el: HTMLElement, style: ScreenplayStyleDefinition): void {
  const vars = styleToCssVars(style)
  for (const [k, v] of Object.entries(vars)) {
    if (v === null) el.style.removeProperty(k)
    else el.style.setProperty(k, v)
  }
  for (const code of COMPLEX_SCRIPT_CODES) {
    el.classList.toggle(`cs-force-italic-${code}`, style.italicScripts?.includes(code) ?? false)
  }
}
