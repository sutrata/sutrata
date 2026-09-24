/**
 * Attribute blocks (format spec §10): `{#id key=value key="quoted value" .class}`
 * at the end of the first line of a scene heading, section heading, or
 * character cue.
 *
 * A trailing `{...}` is only treated as an attribute block when every entry
 * is a recognizable attribute (`#id`, `.class`, `key=value`), so ordinary
 * heading text such as `{DAY 2}` stays text. Entries other than the first
 * `#id` are kept verbatim, in order, so unknown attributes round-trip.
 */

export interface Attribute {
  /** `key` for `key=value`; the whole entry (`.class`, a second `#id`) when valueless. */
  key: string
  /** Unquoted value, or null for a valueless entry. */
  value: string | null
}

export interface AttributeBlock {
  /** The line with the attribute block (and the whitespace before it) removed. */
  body: string
  id: string | null
  attrs: Attribute[]
}

const BLOCK = /\s*\{([^{}]*)\}\s*$/
const ENTRY = /^(?:#([^\s"=#{}]+)|(\.[^\s"={}]+)|([A-Za-z_][\w.:-]*)=(?:"((?:[^"\\]|\\.)*)"|([^\s"{}]*)))(?=\s|$)/

/** Parse the entries inside `{...}`; null if any entry is not an attribute. */
function parseEntries(inner: string): { id: string | null; attrs: Attribute[] } | null {
  let rest = inner.trim()
  if (rest === '') return null
  let id: string | null = null
  const attrs: Attribute[] = []
  while (rest !== '') {
    const m = ENTRY.exec(rest)
    if (!m) return null
    if (m[1] !== undefined) {
      if (id === null) id = m[1]
      else attrs.push({ key: `#${m[1]}`, value: null })
    } else if (m[2] !== undefined) {
      attrs.push({ key: m[2], value: null })
    } else {
      const quoted = m[4]
      attrs.push({ key: m[3]!, value: quoted !== undefined ? quoted.replace(/\\(.)/g, '$1') : m[5]! })
    }
    rest = rest.slice(m[0].length).trimStart()
  }
  return { id, attrs }
}

/**
 * Split a trailing attribute block off `line`. Lines without one (or with a
 * `{...}` that is not a valid attribute block) come back unchanged with no
 * id and no attributes.
 */
export function splitAttributeBlock(line: string): AttributeBlock {
  const m = BLOCK.exec(line)
  if (m) {
    // The block must be separated from preceding text by whitespace (or be
    // the whole line), matching `## Heading {#id}`.
    const start = m.index
    const leadingWs = m[0].length - m[0].trimStart().length
    if (start === 0 || leadingWs > 0) {
      const parsed = parseEntries(m[1]!)
      if (parsed) return { body: line.slice(0, start), ...parsed }
    }
  }
  return { body: line, id: null, attrs: [] }
}

function formatValue(value: string): string {
  return /^[^\s"{}]+$/.test(value) ? value : `"${value.replace(/["\\]/g, '\\$&')}"`
}

/** ` {#id k=v …}` for serialization, or '' when there is nothing to write. */
export function formatAttributeBlock(id: string | null, attrs: readonly Attribute[]): string {
  const parts: string[] = []
  if (id) parts.push(`#${id}`)
  for (const a of attrs) parts.push(a.value === null ? a.key : `${a.key}=${formatValue(a.value)}`)
  return parts.length > 0 ? ` {${parts.join(' ')}}` : ''
}
