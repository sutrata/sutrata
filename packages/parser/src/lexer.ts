import { splitAttributeBlock, type Attribute } from './attributes.js'

export type TokenType =
  | 'section'
  | 'scene-heading'
  | 'scene-metadata'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'transition'
  | 'centered'
  | 'lyrics'
  | 'note'
  | 'comment'
  | 'page-break'
  | 'blank'

export interface Token {
  type: TokenType
  raw: string
  text?: string
  key?: string
  value?: string
  id?: string | null
  attrs?: Attribute[]
  level?: 1
  extension?: string | null
  isDual?: boolean
}

const SCENE_HEADING  = /^##(?:\s+(.*?))?\s*$/
const SECTION        = /^#(?:\s+(.*?))?\s*$/
const CHARACTER      = /^@(.*?)((?:\s+\([^()]*\))+)?\s*(\^)?\s*$/
const METADATA       = /^&\s+([a-zA-Z0-9_-]+):\s*(.*)$/
const CENTERED       = /^>>\s+(.+?)\s+<<\s*$/
const TRANSITION     = /^>>\s+(.+?)\s*$/
const LYRICS         = /^~\s+(.*)$/
const NOTE_SINGLE    = /^\[\[\s*(.*?)\s*\]\]\s*$/
const COMMENT        = /^<!--([\s\S]*?)-->\s*$/
const PAGE_BREAK     = /^===\s*$/
const PARENTHETICAL  = /^[(（]\s*(.*?)\s*[)）]\s*$/

/**
 * Tokenizes a single line of Sutra text.
 * Multi-line <!-- ... --> comments must open and close on the same line;
 * a bare <!-- without a closing --> on the same line is tokenized as 'action'.
 * Dialogue context (lines after a character cue) is resolved by the parser, not here.
 */
export function tokenize(line: string): Token[] {
  const raw = line
  const trimmed = line.trimEnd()

  if (trimmed === '') return [{ type: 'blank', raw }]
  if (PAGE_BREAK.test(trimmed)) return [{ type: 'page-break', raw }]

  let m: RegExpMatchArray | null

  m = trimmed.match(COMMENT)
  if (m) return [{ type: 'comment', raw, text: m[1]!.trim() }]

  m = trimmed.match(NOTE_SINGLE)
  if (m) return [{ type: 'note', raw, text: m[1]! }]

  // centered MUST be checked before transition (both start with >>)
  m = trimmed.match(CENTERED)
  if (m) return [{ type: 'centered', raw, text: m[1]! }]

  m = trimmed.match(TRANSITION)
  if (m) return [{ type: 'transition', raw, text: m[1]! }]

  m = trimmed.match(SCENE_HEADING)
  if (m) {
    const { body, id, attrs } = splitAttributeBlock(m[1] ?? '')
    return [{ type: 'scene-heading', raw, text: body.trim(), id, attrs }]
  }

  m = trimmed.match(SECTION)
  if (m) {
    const { body, id, attrs } = splitAttributeBlock(m[1] ?? '')
    return [{ type: 'section', raw, text: body.trim(), id, attrs, level: 1 }]
  }

  if (trimmed.startsWith('@')) {
    // The attribute block (§10) ends the cue line, after any extension and ^.
    const { body, id, attrs } = splitAttributeBlock(trimmed.slice(1))
    m = ('@' + body).match(CHARACTER)
    if (m) return [{
      type: 'character', raw,
      text: (m[1] ?? '').trim(),
      extension: m[2] ? m[2].trim() : null,
      isDual: m[3] === '^',
      id, attrs,
    }]
  }

  m = trimmed.match(METADATA)
  if (m) return [{ type: 'scene-metadata', raw, key: m[1]!, value: m[2]!.trim() }]

  m = trimmed.match(LYRICS)
  if (m) return [{ type: 'lyrics', raw, text: m[1]! }]

  m = trimmed.match(PARENTHETICAL)
  if (m) return [{ type: 'parenthetical', raw, text: m[1]! }]

  return [{ type: 'action', raw, text: trimmed }]
}
