import { Node as PmNode } from 'prosemirror-model'
import { schema } from './schema'
import type { DocumentNode, SceneHeadingNode, SceneContentNode, SceneMetadataNode,
  InlineSpan } from '@sutrata/parser'

function spansToNodes(spans: InlineSpan[]): PmNode[] {
  return spans.flatMap(span => {
    if (span.type === 'text') return span.text ? [schema.text(span.text)] : []
    if (span.type === 'note') {
      if (!span.text) return []
      const markType = schema.marks['note_mark']!
      return [schema.text(span.text).mark([markType.create()])]
    }
    const inner = spansToNodes(span.spans)
    const markType = schema.marks[span.type]
    if (!markType || inner.length === 0) return inner
    // addToSet, not a replacement: nested emphasis keeps every mark.
    return inner.map(n => n.mark(markType.create().addToSet(n.marks)))
  })
}

function textNodes(text: string): PmNode[] {
  const lines = text.split('\n')
  const nodes: PmNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line) nodes.push(schema.text(line))
    if (i < lines.length - 1) nodes.push(schema.nodes['hard_break']!.create())
  }
  return nodes
}

/** `& key: value` → scene_metadata; a list value becomes one line per item. */
function metadataNode(meta: SceneMetadataNode): PmNode {
  if (meta.items) {
    return schema.nodes['scene_metadata']!.create({ metaKey: meta.key, list: true }, textNodes(meta.items.join('\n')))
  }
  return schema.nodes['scene_metadata']!.create({ metaKey: meta.key }, textNodes(meta.value))
}

function sceneContentToNodes(nodes: SceneContentNode[]): PmNode[] {
  const result: PmNode[] = []
  for (const node of nodes) {
    switch (node.type) {
      case 'action':
        result.push(schema.nodes['action']!.create({}, spansToNodes(node.spans)))
        break
      case 'character': {
        // Name, extension and dual-marker are rendered as one continuous
        // text run — see character-decoration-plugin.ts, which recognizes
        // a trailing "(...)"/"^" live and styles it, rather than storing
        // them as separate node attrs.
        const cueText = [node.name, node.extension, node.isDual ? '^' : null]
          .filter((part): part is string => !!part)
          .join(' ')
        result.push(schema.nodes['character']!.create({ id: node.id, attrs: node.attrs }, textNodes(cueText)))
        // Character-registry metadata (§8.2) follows the cue, before any dialogue.
        for (const meta of node.metadata ?? []) result.push(metadataNode(meta))
        for (const child of node.children) {
          if (child.type === 'dialogue') {
            result.push(schema.nodes['dialogue']!.create({}, spansToNodes(child.spans)))
          } else {
            result.push(schema.nodes['parenthetical']!.create({}, textNodes(child.text)))
          }
        }
        break
      }
      case 'dual-dialogue':
        result.push(...sceneContentToNodes([node.left]))
        result.push(...sceneContentToNodes([node.right]))
        break
      case 'transition':
        result.push(schema.nodes['transition']!.create({}, textNodes(node.text)))
        break
      case 'centered':
        result.push(schema.nodes['centered']!.create({}, textNodes(node.text)))
        break
      case 'lyrics':
        result.push(schema.nodes['lyrics']!.create({}, spansToNodes(node.spans)))
        break
      case 'note':
        result.push(schema.nodes['note']!.create({}, textNodes(node.text)))
        break
      case 'comment':
        result.push(schema.nodes['comment']!.create({}, textNodes(node.text)))
        break
      case 'page-break':
        result.push(schema.nodes['page_break']!.create())
        break
    }
  }
  return result
}

/**
 * Frontmatter → title_page node. One frontmatter_field per key; one-level
 * nested maps (multilingual title:) flatten to dotted keys ("title.hi").
 */
function frontmatterToNode(doc: DocumentNode): PmNode | null {
  const fm = doc.frontmatter
  if (!fm) return null
  const fields = frontmatterFields(fm.data).map(([key, value]) =>
    schema.nodes['frontmatter_field']!.create({ fmKey: key }, textNodes(value)))
  if (fields.length === 0) return null
  return schema.nodes['title_page']!.create({ raw: fm.raw }, fields)
}

/** The (fmKey, value) pairs a title_page shows for parsed frontmatter data. */
export function frontmatterFields(data: Record<string, unknown>): [string, string][] {
  const fields: [string, string][] = []
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === 'object') {
      for (const [sub, subVal] of Object.entries(value as Record<string, string>)) {
        fields.push([`${key}.${sub}`, String(subVal)])
      }
    } else {
      fields.push([key, String(value ?? '')])
    }
  }
  return fields
}

export function sutraToProsemirror(doc: DocumentNode): PmNode {
  const topNodes: PmNode[] = []

  const titlePage = frontmatterToNode(doc)
  if (titlePage) topNodes.push(titlePage)

  for (const node of doc.children) {
    switch (node.type) {
      case 'section':
        topNodes.push(schema.nodes['section']!.create({ level: node.level, id: node.id, attrs: node.attrs }, textNodes(node.text)))
        break
      case 'scene-heading': {
        const sceneNode = node as SceneHeadingNode
        topNodes.push(schema.nodes['scene_heading']!.create({ id: sceneNode.id, attrs: sceneNode.attrs }, textNodes(sceneNode.text)))
        for (const meta of sceneNode.metadata) topNodes.push(metadataNode(meta))
        topNodes.push(...sceneContentToNodes(sceneNode.children))
        break
      }
      default:
        // Everything else (including cues outside a scene, e.g. a cold open
        // or the {#characters} registry) maps exactly as inside a scene.
        topNodes.push(...sceneContentToNodes([node]))
    }
  }

  // doc content is 'title_page? block+' — always need at least one body block
  const hasBlock = topNodes.some(n => n.type.name !== 'title_page')
  if (!hasBlock) {
    topNodes.push(schema.nodes['action']!.create({}, []))
  }

  return schema.nodes['doc']!.create({}, topNodes)
}
