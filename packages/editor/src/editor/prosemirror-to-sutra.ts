import { Node as PmNode, type Mark } from 'prosemirror-model'
import { parseFrontmatter, formatAttributeBlock, type Attribute } from '@sutrata/parser'
import { schema } from './schema'
import { frontmatterFields } from './sutra-to-prosemirror'

/** Plain text of a block, with hard_break nodes as '\n'. */
function nodeText(node: PmNode): string {
  let result = ''
  node.forEach(child => {
    if (child.isText) result += child.text ?? ''
    else if (child.type === schema.nodes['hard_break']) result += '\n'
  })
  return result
}

const DELIMITERS: Record<string, [string, string]> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  underline: ['_', '_'],
  note_mark: ['[[', ']]'],
}

/**
 * Inline content → Sutra emphasis markup. Marks are opened and closed as a
 * stack (ProseMirror orders them bold → italic → underline → note), so
 * overlapping marks nest: bold+italic text becomes `***text***`.
 *
 * With `closeAtNewline`, every line is closed off on its own. Lyrics need
 * that (the parser reads each `~` line separately); action does not (its
 * whole paragraph is parsed as one run, so emphasis may span lines).
 */
function inlineToMarkdown(node: PmNode, closeAtNewline = false): string {
  let out = ''
  let open: Mark[] = []

  const closeTo = (depth: number) => {
    while (open.length > depth) out += DELIMITERS[open.pop()!.type.name]?.[1] ?? ''
  }
  const write = (text: string, marks: readonly Mark[]) => {
    const wanted = marks.filter(m => DELIMITERS[m.type.name])
    let common = 0
    while (common < open.length && common < wanted.length && open[common]!.eq(wanted[common]!)) common++
    closeTo(common)
    for (const m of wanted.slice(common)) {
      out += DELIMITERS[m.type.name]![0]
      open.push(m)
    }
    out += text
  }

  node.forEach(child => {
    if (child.type === schema.nodes['hard_break']) {
      closeTo(0)
      out += '\n'
    } else if (child.isText) {
      const text = child.text ?? ''
      if (!closeAtNewline) { write(text, child.marks); return }
      text.split('\n').forEach((line, i) => {
        if (i > 0) { closeTo(0); out += '\n' }
        if (line) write(line, child.marks)
      })
    }
  })
  closeTo(0)
  open = []
  return out
}

function attributeBlock(node: PmNode): string {
  return formatAttributeBlock((node.attrs['id'] as string | null) ?? null, (node.attrs['attrs'] as Attribute[] | undefined) ?? [])
}

/** `& key: value`, or `& key:` followed by `  - item` lines for a list value. */
function metadataLines(node: PmNode): string[] {
  const key = node.attrs['metaKey'] as string
  const value = nodeText(node)
  if (node.attrs['list']) {
    const items = value.split('\n')
    return [`& ${key}:`, ...items.map(item => (item.trim() ? `  - ${item.trim()}` : '  -'))]
  }
  return [`& ${key}: ${value}`.trimEnd()]
}

/**
 * Extract the text value of a frontmatter_field node, converting hard_break
 * nodes back to '\n' so multi-line values round-trip correctly.
 */
function fieldText(node: PmNode): string {
  return nodeText(node).trim()
}

type FieldValue = string | Record<string, string>

/**
 * title_page fields → one value per top-level key. Dotted keys ("title.hi")
 * are reassembled into one-level nested maps. Fields without a key are skipped.
 */
function groupFields(fields: [string, string][]): Map<string, FieldValue> {
  const data = new Map<string, FieldValue>()
  for (const [rawKey, value] of fields) {
    const key = rawKey.trim()
    if (!key) continue
    const dot = key.indexOf('.')
    if (dot > 0 && dot < key.length - 1) {
      const parent = key.slice(0, dot)
      const existing = data.get(parent)
      const map: Record<string, string> = existing !== undefined && typeof existing === 'object' ? existing : {}
      map[key.slice(dot + 1)] = value
      data.set(parent, map)
    } else {
      data.set(key, value)
    }
  }
  return data
}

/**
 * YAML lines for one key, in the subset the parser's minimal YAML reader
 * understands: plain scalars, `|` literal blocks for multi-line values, and
 * one level of nested map (2-space indent).
 */
function keyLines(key: string, value: FieldValue): string[] {
  if (typeof value !== 'string') {
    return [`${key}:`, ...Object.entries(value).map(([sub, sv]) => `  ${sub}: ${sv}`)]
  }
  if (value === '') return [`${key}:`]
  if (value.includes('\n')) return [`${key}: |`, ...value.split('\n').map(ln => `  ${ln}`)]
  return [`${key}: ${value}`]
}

function sameValue(a: FieldValue | undefined, b: FieldValue | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

const YAML_KEY = /^([a-zA-Z0-9_-]+):/

/**
 * title_page node → frontmatter text block (ending in a blank line), or ''.
 *
 * When the node was built from frontmatter source (its `raw` attr), that
 * source is kept: unchanged keys keep their original lines — including
 * comments, lists, quoting and order the fields cannot represent — and only
 * keys whose value changed are rewritten, removed, or appended.
 */
function serializeTitlePage(node: PmNode): string {
  const fields: [string, string][] = []
  node.forEach(field => {
    if (field.type.name === 'frontmatter_field') fields.push([(field.attrs['fmKey'] as string) ?? '', fieldText(field)])
  })
  const current = groupFields(fields)

  const raw = node.attrs['raw'] as string | null
  const parsed = raw ? parseFrontmatter(raw.endsWith('\n') ? raw : raw + '\n') : null
  if (!raw || !parsed) {
    if (current.size === 0) return ''
    return ['---', ...[...current].flatMap(([k, v]) => keyLines(k, v)), '---'].join('\n') + '\n\n'
  }

  const original = groupFields(frontmatterFields(parsed.data).map(([k, v]) => [k, v.trim()]))
  const lines = raw.replace(/\n$/, '').split('\n')
  const body = lines.slice(1, -1)   // between the --- fences

  // Group raw lines into entries: a key line plus its continuation lines.
  const entries: { key: string | null; lines: string[] }[] = []
  for (const line of body) {
    const m = YAML_KEY.exec(line)
    if (m) entries.push({ key: m[1]!, lines: [line] })
    else if (entries.length > 0) entries[entries.length - 1]!.lines.push(line)
    else entries.push({ key: null, lines: [line] })
  }

  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const key = entry.key
    if (key === null || !original.has(key) || sameValue(original.get(key), current.get(key))) {
      if (key !== null && original.has(key) && !current.has(key)) continue   // removed
      out.push(...entry.lines)
    } else if (current.has(key)) {
      out.push(...keyLines(key, current.get(key)!))
    }
    if (key !== null) seen.add(key)
  }
  for (const [key, value] of current) if (!seen.has(key)) out.push(...keyLines(key, value))

  if (!out.some(l => l.trim() !== '')) return ''
  return ['---', ...out, '---'].join('\n') + '\n\n'
}

export function prosemirrorToSutra(doc: PmNode): string {
  // Collect all top-level nodes into an array first
  const pmNodes: PmNode[] = []
  doc.forEach(node => pmNodes.push(node))

  const blocks: string[] = []
  let i = 0

  let frontmatter = ''
  if (pmNodes.length > 0 && pmNodes[0]!.type.name === 'title_page') {
    frontmatter = serializeTitlePage(pmNodes[0]!)
    i = 1
  }

  while (i < pmNodes.length) {
    const node = pmNodes[i]!
    const type = node.type.name

    if (type === 'character') {
      // Group: character cue + following registry metadata and
      // dialogue/parenthetical lines (no blank line between them).
      // Name, extension and dual-marker are all just typed text now — see
      // character-decoration-plugin.ts — so the node's own text is the
      // whole cue line, verbatim.
      const lines: string[] = [`@${nodeText(node)}${attributeBlock(node)}`]
      i++
      while (i < pmNodes.length) {
        const next = pmNodes[i]!
        const nextType = next.type.name
        if (nextType === 'dialogue') {
          lines.push(inlineToMarkdown(next))
          i++
        } else if (nextType === 'parenthetical') {
          lines.push(`( ${nodeText(next)} )`)
          i++
        } else if (nextType === 'scene_metadata') {
          // Only produced after a cue for {#characters} registry entries (§8.2).
          lines.push(...metadataLines(next))
          i++
        } else {
          break
        }
      }
      blocks.push(lines.join('\n'))
      continue
    }

    if (type === 'scene_heading') {
      // Group heading + metadata lines with single newlines (no blank line
      // between them), so the parser recognises them as one heading block.
      const headingLines: string[] = [`## ${nodeText(node)}${attributeBlock(node)}`]
      i++
      while (i < pmNodes.length && pmNodes[i]!.type.name === 'scene_metadata') {
        headingLines.push(...metadataLines(pmNodes[i]!))
        i++
      }
      blocks.push(headingLines.join('\n'))
      continue
    }
    if (type === 'scene_metadata') {
      // Orphan metadata (outside a heading group) — emit as-is
      blocks.push(metadataLines(node).join('\n'))
      i++; continue
    }
    if (type === 'section') {
      blocks.push(`# ${nodeText(node)}${attributeBlock(node)}`)
      i++; continue
    }
    if (type === 'action') {
      blocks.push(inlineToMarkdown(node))
      i++; continue
    }
    if (type === 'dialogue') {
      // Orphan dialogue (should not occur after the grouping above, but handle gracefully)
      blocks.push(inlineToMarkdown(node))
      i++; continue
    }
    if (type === 'parenthetical') {
      // Orphan parenthetical
      blocks.push(`( ${nodeText(node)} )`)
      i++; continue
    }
    if (type === 'transition') {
      blocks.push(nodeText(node).split('\n').map(l => `>> ${l}`).join('\n'))
      i++; continue
    }
    if (type === 'centered') {
      blocks.push(nodeText(node).split('\n').map(l => `>> ${l} <<`).join('\n'))
      i++; continue
    }
    if (type === 'lyrics') {
      blocks.push(inlineToMarkdown(node, true).split('\n').map(l => `~ ${l}`).join('\n'))
      i++; continue
    }
    if (type === 'note') {
      blocks.push(`[[ ${nodeText(node)} ]]`)
      i++; continue
    }
    if (type === 'comment') {
      blocks.push(`<!-- ${nodeText(node)} -->`)
      i++; continue
    }
    if (type === 'page_break') {
      blocks.push('===')
      i++; continue
    }
    i++ // unknown node type — skip
  }

  return frontmatter + blocks.join('\n\n') + '\n'
}
