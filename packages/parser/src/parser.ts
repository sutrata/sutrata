import { tokenize } from './lexer.js'
import { parseFrontmatter } from './frontmatter.js'
import type {
  DocumentNode, ContentNode, SceneHeadingNode, SceneContentNode,
  CharacterNode, DialogueContentNode, DualDialogueNode,
  SectionNode, ActionNode, SceneMetadataNode,
  DialogueNode, ParentheticalNode, TransitionNode, CenteredNode,
  LyricsNode, NoteNode, CommentNode, PageBreakNode, InlineSpan,
} from './types.js'

function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = []
  let i = 0
  let buf = ''
  while (i < text.length) {
    if (text.startsWith('**', i)) {
      if (buf) { spans.push({ type: 'text', text: buf }); buf = '' }
      const end = text.indexOf('**', i + 2)
      if (end !== -1) {
        spans.push({ type: 'bold', spans: parseInline(text.slice(i + 2, end)) })
        i = end + 2; continue
      }
    }
    if (text[i] === '*' && text[i - 1] !== '*') {
      if (buf) { spans.push({ type: 'text', text: buf }); buf = '' }
      const end = text.indexOf('*', i + 1)
      if (end !== -1) {
        spans.push({ type: 'italic', spans: parseInline(text.slice(i + 1, end)) })
        i = end + 1; continue
      }
    }
    if (text[i] === '_') {
      if (buf) { spans.push({ type: 'text', text: buf }); buf = '' }
      const end = text.indexOf('_', i + 1)
      if (end !== -1) {
        spans.push({ type: 'underline', spans: parseInline(text.slice(i + 1, end)) })
        i = end + 1; continue
      }
    }
    buf += text[i++]
  }
  if (buf) spans.push({ type: 'text', text: buf })
  return spans
}

function parseSceneContent(lines: string[]): SceneContentNode[] {
  const blocks = lines.join('\n').split(/\n\n+/).filter(b => b.trim())
  const nodes: SceneContentNode[] = []
  for (const block of blocks) {
    const blockLines = block.split('\n').filter(l => l.trim() !== '')
    const firstLine = blockLines[0]
    if (!firstLine) continue
    const firstTok = tokenize(firstLine)[0]!
    if (firstTok.type === 'character') {
      const charNode = parseCharacterBlock(blockLines) as CharacterNode
      if (charNode.isDual && nodes.length > 0 && nodes[nodes.length - 1]!.type === 'character') {
        const prev = nodes.pop() as CharacterNode
        const dd: DualDialogueNode = {
          type: 'dual-dialogue', raw: prev.raw + '\n\n' + block,
          left: prev, right: charNode,
        }
        nodes.push(dd)
      } else {
        nodes.push(charNode)
      }
    } else {
      const node = parseBlock(block)
      if (node && node.type !== 'scene-heading') {
        nodes.push(node as SceneContentNode)
      }
    }
  }
  return nodes
}

function parseCharacterBlock(lines: string[]): CharacterNode {
  const firstLine = lines[0]!
  const cueToken = tokenize(firstLine)[0]!
  const children: DialogueContentNode[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    if (!line.trim()) continue
    const t = tokenize(line)[0]!
    if (t.type === 'parenthetical') {
      children.push({ type: 'parenthetical', raw: line, text: t.text ?? '' } as ParentheticalNode)
    } else {
      children.push({ type: 'dialogue', raw: line, spans: parseInline(line.trim()) } as DialogueNode)
    }
  }
  return {
    type: 'character', raw: lines.join('\n'),
    name: cueToken.text ?? '',
    extension: cueToken.extension ?? null,
    isDual: cueToken.isDual ?? false,
    children,
  }
}

function parseBlock(block: string): ContentNode | null {
  const lines = block.split('\n').filter(l => l.trim() !== '')
  if (lines.length === 0) return null

  const firstLine = lines[0]!
  const firstToken = tokenize(firstLine)[0]!

  switch (firstToken.type) {
    case 'page-break':
      return { type: 'page-break', raw: block } as PageBreakNode
    case 'comment':
      return { type: 'comment', raw: block, text: firstToken.text ?? '' } as CommentNode
    case 'note':
      return { type: 'note', raw: block, text: firstToken.text ?? '' } as NoteNode
    case 'centered':
      return { type: 'centered', raw: block, text: firstToken.text ?? '' } as CenteredNode
    case 'transition':
      return { type: 'transition', raw: block, text: firstToken.text ?? '' } as TransitionNode
    case 'lyrics':
      return { type: 'lyrics', raw: block, spans: parseInline(firstToken.text ?? '') } as LyricsNode
    case 'section':
      return {
        type: 'section', raw: block,
        level: 1, text: firstToken.text ?? '',
        id: firstToken.id ?? null, children: [],
      } as SectionNode
    case 'scene-heading': {
      const heading: SceneHeadingNode = {
        type: 'scene-heading', raw: '',   // will be set after collecting heading lines
        text: firstToken.text ?? '',
        id: firstToken.id ?? null,
        metadata: [], children: [],
      }
      let i = 1
      while (i < lines.length) {
        const metaLine = lines[i]!
        const t = tokenize(metaLine)[0]!
        if (t.type === 'scene-metadata') {
          heading.metadata.push({ type: 'scene-metadata', raw: metaLine, key: t.key!, value: t.value ?? '' } as SceneMetadataNode)
          i++
        } else break
      }
      // raw covers only the heading sigil line + scene synopsis + metadata (not children)
      heading.raw = lines.slice(0, i).join('\n')
      heading.children = parseSceneContent(lines.slice(i))
      return heading
    }
    case 'character':
      return parseCharacterBlock(lines)
    default:
      return {
        type: 'action', raw: block,
        spans: parseInline(lines.join('\n')),
      } as ActionNode
  }
}

export function parse(source: string): DocumentNode {
  const normalized = source.replace(/\r\n/g, '\n')
  const frontmatter = parseFrontmatter(normalized)
  const body = frontmatter ? normalized.slice(frontmatter.raw.length) : normalized
  // Blank-line count is normalized: serializer emits exactly \n\n between blocks
  const blocks = body.split(/\n\n+/).filter(b => b.trim())
  const children: ContentNode[] = []
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i]!
    const firstLine = block.split('\n').find(l => l.trim() !== '') ?? ''
    const firstToken = tokenize(firstLine)[0]!

    if (firstToken.type === 'scene-heading') {
      // Collect this block plus all following non-heading blocks as scene children
      const sceneLines = block.split('\n').filter(l => l.trim() !== '')
      i++
      const contentBlocks: string[] = []
      while (i < blocks.length) {
        const nextBlock = blocks[i]!
        const nextFirstLine = nextBlock.split('\n').find(l => l.trim() !== '') ?? ''
        const nextFirstToken = tokenize(nextFirstLine)[0]!
        if (nextFirstToken.type === 'scene-heading' || nextFirstToken.type === 'section') break
        contentBlocks.push(nextBlock)
        i++
      }
      // Parse scene synopsis and metadata from the heading block lines
      const heading: SceneHeadingNode = {
        type: 'scene-heading', raw: block,
        text: firstToken.text ?? '',
        id: firstToken.id ?? null,
        metadata: [], children: [],
      }
      let li = 1
      while (li < sceneLines.length) {
        const metaLine = sceneLines[li]!
        const t = tokenize(metaLine)[0]!
        if (t.type === 'scene-metadata') {
          heading.metadata.push({ type: 'scene-metadata', raw: metaLine, key: t.key!, value: t.value ?? '' } as SceneMetadataNode)
          li++
        } else break
      }
      // The remaining lines from the heading block + content blocks become scene children
      const remainingHeadingLines = sceneLines.slice(li)
      const allContentLines = [
        ...remainingHeadingLines,
        ...contentBlocks.flatMap(b => ['', ...b.split('\n')]),
      ]
      heading.children = parseSceneContent(allContentLines)
      children.push(heading)
    } else {
      const node = parseBlock(block)
      if (node) children.push(node)
      i++
    }
  }
  return { type: 'document', frontmatter, children }
}
