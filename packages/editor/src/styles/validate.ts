import { BODY_ELEMENT_KEYS, COVER_ELEMENT_KEYS, COVER_LAYOUTS } from './types.js'
import type { ScreenplayStyleDefinition } from './types.js'

export type ValidationResult =
  | { ok: true; style: ScreenplayStyleDefinition }
  | { ok: false; errors: string[] }

const ALIGNS = new Set(['left', 'center', 'right'])
const COLOR_RE = /^[0-9a-fA-F]{6}$/

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function validateElement(path: string, data: unknown, errors: string[]): void {
  if (typeof data !== 'object' || data === null) {
    errors.push(`${path}: expected an object`)
    return
  }
  const el = data as Record<string, unknown>
  if (!isFiniteNumber(el['fontSizePt']) || el['fontSizePt'] <= 0) {
    errors.push(`${path}.fontSizePt: expected a positive number`)
  }
  for (const flag of ['bold', 'italic', 'underline'] as const) {
    if (el[flag] !== undefined && typeof el[flag] !== 'boolean') {
      errors.push(`${path}.${flag}: expected a boolean`)
    }
  }
  if (el['color'] !== undefined && (typeof el['color'] !== 'string' || !COLOR_RE.test(el['color']))) {
    errors.push(`${path}.color: expected 6 hex digits with no '#' (e.g. "0A5C6A")`)
  }
  for (const marginKey of ['marginLeftPct', 'marginRightPct'] as const) {
    const v = el[marginKey]
    if (v !== undefined && (!isFiniteNumber(v) || v < 0 || v > 100)) {
      errors.push(`${path}.${marginKey}: expected a number between 0 and 100`)
    }
  }
  if (el['align'] !== undefined && (typeof el['align'] !== 'string' || !ALIGNS.has(el['align']))) {
    errors.push(`${path}.align: expected "left", "center", or "right"`)
  }
  for (const spaceKey of ['spaceBeforePt', 'spaceAfterPt'] as const) {
    const v = el[spaceKey]
    if (v !== undefined && !isFiniteNumber(v)) {
      errors.push(`${path}.${spaceKey}: expected a number`)
    }
  }
}

/** Hand-rolled structural validation for a style imported from a .json file — no schema
 *  library dependency, matching the codebase's other hand-rolled parsers (frontmatter.ts).
 *  Collects every error found rather than failing on the first, for a useful import message. */
export function validateStyleJson(data: unknown): ValidationResult {
  const errors: string[] = []
  if (typeof data !== 'object' || data === null) {
    return { ok: false, errors: ['Expected a JSON object'] }
  }
  const obj = data as Record<string, unknown>

  for (const key of ['id', 'name', 'fontFamily'] as const) {
    if (typeof obj[key] !== 'string' || obj[key] === '') {
      errors.push(`${key}: expected a non-empty string`)
    }
  }
  if (obj['description'] !== undefined && typeof obj['description'] !== 'string') {
    errors.push('description: expected a string')
  }
  if (obj['complexScriptFontOverrides'] !== undefined) {
    const overrides = obj['complexScriptFontOverrides']
    if (typeof overrides !== 'object' || overrides === null) {
      errors.push('complexScriptFontOverrides: expected an object')
    } else if (Object.values(overrides).some(v => typeof v !== 'string' || v === '')) {
      errors.push('complexScriptFontOverrides: expected every value to be a non-empty string')
    }
  }
  if (obj['italicScripts'] !== undefined) {
    const scripts = obj['italicScripts']
    if (!Array.isArray(scripts) || scripts.some(v => typeof v !== 'string' || v === '')) {
      errors.push('italicScripts: expected an array of non-empty strings')
    }
  }

  if (obj['coverLayout'] !== undefined && !COVER_LAYOUTS.includes(obj['coverLayout'] as never)) {
    errors.push(`coverLayout: expected ${COVER_LAYOUTS.map(l => `"${l}"`).join(' or ')}`)
  }

  const page = obj['page']
  if (typeof page !== 'object' || page === null) {
    errors.push('page: expected an object')
  } else {
    const p = page as Record<string, unknown>
    for (const key of ['marginTopIn', 'marginBottomIn', 'marginLeftIn', 'marginRightIn'] as const) {
      if (!isFiniteNumber(p[key]) || p[key] < 0) {
        errors.push(`page.${key}: expected a non-negative number`)
      }
    }
  }

  const elements = obj['elements']
  if (typeof elements !== 'object' || elements === null) {
    errors.push('elements: expected an object')
  } else {
    const el = elements as Record<string, unknown>
    for (const key of [...BODY_ELEMENT_KEYS, ...COVER_ELEMENT_KEYS]) {
      if (!(key in el)) {
        errors.push(`elements.${key}: missing`)
      } else {
        validateElement(`elements.${key}`, el[key], errors)
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, style: obj as unknown as ScreenplayStyleDefinition }
}
