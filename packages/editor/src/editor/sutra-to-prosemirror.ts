import { Node as PmNode } from 'prosemirror-model'
import { schema } from './schema'
import type { DocumentNode, SceneHeadingNode, SceneContentNode,
  InlineSpan } from '@sutra/parser'

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
    return inner.map(n => n.mark([markType.create()]))
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
        result.push(schema.nodes['character']!.create({}, textNodes(cueText)))
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
  const fields: PmNode[] = []
  for (const [key, value] of Object.entries(fm.data)) {
    if (value !== null && typeof value === 'object') {
      for (const [sub, subVal] of Object.entries(value as Record<string, string>)) {
        fields.push(schema.nodes['frontmatter_field']!.create({ fmKey: `${key}.${sub}` }, textNodes(String(subVal))))
      }
    } else {
      fields.push(schema.nodes['frontmatter_field']!.create({ fmKey: key }, textNodes(String(value ?? ''))))
    }
  }
  if (fields.length === 0) return null
  return schema.nodes['title_page']!.create({}, fields)
}

export function sutraToProsemirror(doc: DocumentNode): PmNode {
  const topNodes: PmNode[] = []

  const titlePage = frontmatterToNode(doc)
  if (titlePage) topNodes.push(titlePage)

  for (const node of doc.children) {
    switch (node.type) {
      case 'section':
        topNodes.push(schema.nodes['section']!.create({ level: node.level, id: node.id }, textNodes(node.text)))
        break
      case 'scene-heading': {
        const sceneNode = node as SceneHeadingNode
        topNodes.push(schema.nodes['scene_heading']!.create({ id: sceneNode.id }, textNodes(sceneNode.text)))
        for (const meta of sceneNode.metadata) {
          topNodes.push(schema.nodes['scene_metadata']!.create({ metaKey: meta.key }, textNodes(meta.value)))
        }
        topNodes.push(...sceneContentToNodes(sceneNode.children))
        break
      }
      case 'action':
        topNodes.push(schema.nodes['action']!.create({}, spansToNodes(node.spans)))
        break
      case 'transition':
        topNodes.push(schema.nodes['transition']!.create({}, textNodes(node.text)))
        break
      case 'centered':
        topNodes.push(schema.nodes['centered']!.create({}, textNodes(node.text)))
        break
      case 'lyrics':
        topNodes.push(schema.nodes['lyrics']!.create({}, spansToNodes(node.spans)))
        break
      case 'note':
        topNodes.push(schema.nodes['note']!.create({}, textNodes(node.text)))
        break
      case 'comment':
        topNodes.push(schema.nodes['comment']!.create({}, textNodes(node.text)))
        break
      case 'page-break':
        topNodes.push(schema.nodes['page_break']!.create())
        break
    }
  }

  // doc content is 'title_page? block+' — always need at least one body block
  const hasBlock = topNodes.some(n => n.type.name !== 'title_page')
  if (!hasBlock) {
    topNodes.push(schema.nodes['action']!.create({}, []))
  }

  return schema.nodes['doc']!.create({}, topNodes)
}
