import type {
  DocumentNode, ContentNode, SceneHeadingNode,
} from './types.js'
import { serializeFrontmatter } from './frontmatter.js'

function serializeContent(node: ContentNode): string {
  if (node.type === 'scene-heading') {
    const heading: SceneHeadingNode = node
    if (heading.children.length === 0) return heading.raw.trim()
    return heading.raw.trim() + '\n\n' + heading.children.map(c => c.raw.trim()).join('\n\n')
  }
  // SectionNode.children is always [] — parser does not yet nest children under sections
  return node.raw.trim()
}

export function serialize(doc: DocumentNode): string {
  const parts: string[] = []
  if (doc.frontmatter) {
    parts.push(serializeFrontmatter(doc.frontmatter).trim())
  }
  for (const child of doc.children) {
    parts.push(serializeContent(child))
  }
  return parts.join('\n\n') + '\n'
}
