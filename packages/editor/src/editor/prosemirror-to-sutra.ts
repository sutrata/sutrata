import { Node as PmNode } from 'prosemirror-model'
import { schema } from './schema'

function nodeText(node: PmNode): string {
  return node.textContent
}

function inlineToMarkdown(node: PmNode): string {
  let result = ''
  node.forEach(child => {
    if (child.isText) {
      let text = child.text ?? ''
      if (child.marks.find(m => m.type === schema.marks['bold'])) text = `**${text}**`
      else if (child.marks.find(m => m.type === schema.marks['italic'])) text = `*${text}*`
      else if (child.marks.find(m => m.type === schema.marks['underline'])) text = `_${text}_`
      else if (child.marks.find(m => m.type === schema.marks['note_mark'])) text = `[[${text}]]`
      result += text
    }
  })
  return result
}

/**
 * Extract the text value of a frontmatter_field node, converting hard_break
 * nodes back to '\n' so multi-line values round-trip correctly.
 */
function fieldText(node: PmNode): string {
  let result = ''
  node.forEach(child => {
    if (child.isText) result += child.text ?? ''
    else if (child.type === schema.nodes['hard_break']) result += '\n'
  })
  return result.trim()
}

/**
 * title_page node → frontmatter text block. Dotted keys ("title.hi") are
 * reassembled into one-level nested maps (2-space indent, matching the
 * parser's minimal-YAML frontmatter format). Fields with empty key AND
 * empty value are skipped; returns '' if nothing remains.
 * Multi-line values are serialized as YAML literal block scalars (|).
 */
function serializeTitlePage(node: PmNode): string {
  const data = new Map<string, string | Record<string, string>>()
  node.forEach(field => {
    if (field.type.name !== 'frontmatter_field') return
    const key = ((field.attrs['fmKey'] as string) ?? '').trim()
    const value = fieldText(field)
    if (!key) return
    const dot = key.indexOf('.')
    if (dot > 0 && dot < key.length - 1) {
      const parent = key.slice(0, dot)
      const sub = key.slice(dot + 1)
      const existing = data.get(parent)
      const map: Record<string, string> = existing !== undefined && typeof existing === 'object' ? existing : {}
      map[sub] = value
      data.set(parent, map)
    } else {
      data.set(key, value)
    }
  })
  if (data.size === 0) return ''
  const lines: string[] = ['---']
  for (const [key, value] of data) {
    if (typeof value === 'string') {
      if (value === '') {
        lines.push(`${key}:`)
      } else if (value.includes('\n')) {
        // YAML literal block scalar: preserves newlines verbatim
        lines.push(`${key}: |`)
        for (const ln of value.split('\n')) lines.push(`  ${ln}`)
      } else {
        lines.push(`${key}: ${value}`)
      }
    } else {
      lines.push(`${key}:`)
      for (const [sub, sv] of Object.entries(value)) lines.push(`  ${sub}: ${sv}`)
    }
  }
  lines.push('---')
  return lines.join('\n') + '\n\n'
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
      // Group: character cue + following dialogue/parenthetical lines (no blank line between them).
      // Name, extension and dual-marker are all just typed text now — see
      // character-decoration-plugin.ts — so the node's own text is the
      // whole cue line, verbatim.
      const lines: string[] = [`@${nodeText(node)}`]
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
        } else {
          break
        }
      }
      blocks.push(lines.join('\n'))
      continue
    }

    if (type === 'scene_heading') {
      const id = node.attrs['id'] ? ` {#${node.attrs['id'] as string}}` : ''
      // Group heading + optional synopsis + metadata lines with single newlines (no blank
      // line between them), so the parser recognises them as one heading block.
      const headingLines: string[] = [`## ${nodeText(node)}${id}`]
      i++
      while (i < pmNodes.length && pmNodes[i]!.type.name === 'scene_metadata') {
        const m = pmNodes[i]!
        headingLines.push(`& ${m.attrs['metaKey'] as string}: ${nodeText(m)}`)
        i++
      }
      blocks.push(headingLines.join('\n'))
      continue
    }
    if (type === 'scene_metadata') {
      // Orphan metadata (outside a heading group) — emit as-is
      blocks.push(`& ${node.attrs['metaKey'] as string}: ${nodeText(node)}`)
      i++; continue
    }
    if (type === 'section') {
      const id = node.attrs['id'] ? ` {#${node.attrs['id'] as string}}` : ''
      blocks.push(`# ${nodeText(node)}${id}`)
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
      blocks.push(`>> ${nodeText(node)}`)
      i++; continue
    }
    if (type === 'centered') {
      blocks.push(`>> ${nodeText(node)} <<`)
      i++; continue
    }
    if (type === 'lyrics') {
      blocks.push(`~ ${inlineToMarkdown(node)}`)
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
