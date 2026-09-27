import { tokenize } from './lexer.js'
import { parseFrontmatter } from './frontmatter.js'
import { extractComments, type ExtractedComment, type CommentShift } from './comments.js'
import type {
  DocumentNode, ContentNode, SceneHeadingNode, SceneContentNode,
  CharacterNode, DialogueContentNode, DualDialogueNode,
  SectionNode, ActionNode, SceneMetadataNode,
  DialogueNode, ParentheticalNode, TransitionNode, CenteredNode,
  LyricsNode, NoteNode, CommentNode, PageBreakNode, InlineSpan,
  SourceSpan, ParseWithSpansResult,
} from './types.js'

function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = []
  let i = 0
  let buf = ''
  while (i < text.length) {
    if (text.startsWith('[[', i)) {
      const end = text.indexOf(']]', i + 2)
      if (end !== -1) {
        if (buf) { spans.push({ type: 'text', text: buf }); buf = '' }
        spans.push({ type: 'note', text: text.slice(i + 2, end).trim() })
        i = end + 2; continue
      }
    }
    if (text.startsWith('**', i)) {
      if (buf) { spans.push({ type: 'text', text: buf }); buf = '' }
      // Skip a closing ** that is immediately followed by another *, so the
      // bold closes on the *last* two stars: ***x*** is bold(italic(x)).
      let end = text.indexOf('**', i + 2)
      while (end !== -1 && text[end + 2] === '*') end = text.indexOf('**', end + 1)
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

const LIST_ITEM = /^\s+-(?:\s+(.*))?$/

/**
 * Collect `& key: value` lines starting at `lines[start]`. A key with an empty
 * value takes the indented `- item` lines after it as its list (§7.1).
 * Returns the metadata and the index of the first line not consumed.
 */
function collectMetadata(lines: string[], start: number): { metadata: SceneMetadataNode[]; next: number } {
  const metadata: SceneMetadataNode[] = []
  let i = start
  while (i < lines.length) {
    const line = lines[i]!
    const t = tokenize(line)[0]!
    if (t.type !== 'scene-metadata') break
    const node: SceneMetadataNode = { type: 'scene-metadata', raw: line, key: t.key!, value: t.value ?? '' }
    i++
    if (node.value === '') {
      const items: string[] = []
      const rawLines = [line]
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i]!.trimEnd())
        if (!m) break
        items.push((m[1] ?? '').trim())
        rawLines.push(lines[i]!)
        i++
      }
      if (items.length > 0) {
        node.items = items
        node.raw = rawLines.join('\n')
      }
    }
    metadata.push(node)
  }
  return { metadata, next: i }
}

/** True when every non-blank line of `block` is scene metadata (or its list items). */
function isMetadataBlock(block: string): boolean {
  const lines = block.split('\n').filter(l => l.trim() !== '')
  return lines.length > 0 && collectMetadata(lines, 0).next === lines.length
}

/** Strip a leading `>>` (and, for centered text, a trailing `<<`) from a continuation line. */
function stripChevrons(line: string, centered: boolean): string {
  let t = line.trim().replace(/^>>\s*/, '')
  if (centered) t = t.replace(/\s*<<$/, '')
  return t
}

function parseSceneContent(lines: string[], comments: Map<string, ExtractedComment>): SceneContentNode[] {
  const blocks = lines.join('\n').split(/\n\n+/).filter(b => b.trim())
  const nodes: SceneContentNode[] = []
  for (const block of blocks) {
    const extracted = comments.get(block.trim())
    if (extracted) {
      nodes.push({ type: 'comment', raw: extracted.raw, text: extracted.text } as CommentNode)
      continue
    }
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
      const node = parseBlock(block, comments)
      if (node && node.type !== 'scene-heading') {
        nodes.push(node as SceneContentNode)
      }
    }
  }
  return nodes
}

// Matches the {#characters} / bare "# Characters" detection already proven
// at romanize.ts's registry-scoping heuristic — kept in sync deliberately.
function isCharacterRegistrySection(id: string | null, text: string): boolean {
  return id === 'characters' || /^characters$/i.test(text.trim())
}

function parseCharacterBlock(lines: string[], inCharacterRegistry = false): CharacterNode {
  const firstLine = lines[0]!
  const cueToken = tokenize(firstLine)[0]!
  const children: DialogueContentNode[] = []
  const metadata: SceneMetadataNode[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    if (!line.trim()) continue
    const t = tokenize(line)[0]!
    if (inCharacterRegistry && t.type === 'scene-metadata') {
      const collected = collectMetadata(lines, i)
      metadata.push(...collected.metadata)
      i = collected.next - 1
    } else if (t.type === 'parenthetical') {
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
    id: cueToken.id ?? null,
    attrs: cueToken.attrs ?? [],
    children,
    ...(metadata.length > 0 ? { metadata } : {}),
  }
}

function parseBlock(
  block: string,
  comments: Map<string, ExtractedComment>,
  inCharacterRegistry = false
): ContentNode | null {
  const extracted = comments.get(block.trim())
  if (extracted) {
    return { type: 'comment', raw: extracted.raw, text: extracted.text } as CommentNode
  }

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
      // A standalone note is a whole block (§11.1 rule 11); a [[…]] line
      // followed by more text is an action paragraph with an inline note.
      if (lines.length > 1) break
      return { type: 'note', raw: block, text: firstToken.text ?? '' } as NoteNode
    case 'centered':
      // Continuation lines of a centered/transition block belong to it; each
      // may repeat the >> (and << for centered) sigils.
      return {
        type: 'centered', raw: block,
        text: [firstToken.text ?? '', ...lines.slice(1).map(l => stripChevrons(l, true))].join('\n'),
      } as CenteredNode
    case 'transition':
      return {
        type: 'transition', raw: block,
        text: [firstToken.text ?? '', ...lines.slice(1).map(l => stripChevrons(l, false))].join('\n'),
      } as TransitionNode
    case 'lyrics': {
      // One ~ per line (§6.8); lines are joined with a '\n' text span.
      const spans: InlineSpan[] = []
      lines.forEach((line, idx) => {
        if (idx > 0) spans.push({ type: 'text', text: '\n' })
        const t = tokenize(line)[0]!
        spans.push(...parseInline(t.type === 'lyrics' ? t.text ?? '' : line.trim()))
      })
      return { type: 'lyrics', raw: block, spans } as LyricsNode
    }
    case 'section':
      return {
        type: 'section', raw: block,
        level: 1, text: firstToken.text ?? '',
        id: firstToken.id ?? null, attrs: firstToken.attrs ?? [], children: [],
      } as SectionNode
    case 'scene-heading': {
      const { metadata, next: i } = collectMetadata(lines, 1)
      const heading: SceneHeadingNode = {
        type: 'scene-heading',
        // raw covers only the heading sigil line + metadata (not children)
        raw: lines.slice(0, i).join('\n'),
        text: firstToken.text ?? '',
        id: firstToken.id ?? null,
        attrs: firstToken.attrs ?? [],
        metadata, children: [],
      }
      heading.children = parseSceneContent(lines.slice(i), comments)
      return heading
    }
    case 'character':
      return parseCharacterBlock(lines, inCharacterRegistry)
  }
  return {
    type: 'action', raw: block,
    spans: parseInline(lines.join('\n')),
  } as ActionNode
}

/** A block of the comment-extracted body and where it sits in that body. */
interface Block {
  text: string
  start: number
}

/** Same blocks as `body.split(/\n\n+/).filter(b => b.trim())`, with positions. */
function splitBlocks(body: string): Block[] {
  const blocks: Block[] = []
  let pos = 0
  for (const m of body.matchAll(/\n\n+/g)) {
    if (body.slice(pos, m.index).trim()) blocks.push({ text: body.slice(pos, m.index), start: pos })
    pos = m.index! + m[0].length
  }
  if (body.slice(pos).trim()) blocks.push({ text: body.slice(pos), start: pos })
  return blocks
}

/** From the start of a block's first non-blank line to the end of its last one. */
function blockSpan(block: Block): SourceSpan {
  const lines = block.text.split('\n')
  const first = lines.findIndex(l => l.trim() !== '')
  let last = lines.length - 1
  while (lines[last]!.trim() === '') last--
  let start = block.start
  for (let k = 0; k < first; k++) start += lines[k]!.length + 1
  let end = start
  for (let k = first; k <= last; k++) end += lines[k]!.length + (k < last ? 1 : 0)
  return { start, end }
}

/**
 * Maps an offset in the comment-extracted body back to the source passed to
 * parse(): undoes comment placeholders, the frontmatter slice and CRLF → LF.
 */
function offsetMapper(source: string, bodyStart: number, shifts: CommentShift[]): (offset: number) => number {
  // Normalized-text index of each LF that was preceded by a removed CR.
  const crlf: number[] = []
  for (let p = source.indexOf('\r\n'); p !== -1; p = source.indexOf('\r\n', p + 2)) crlf.push(p - crlf.length)
  return (offset: number) => {
    let n = offset
    for (const s of shifts) {
      if (s.at + s.placeholderLength > offset) break
      n += s.rawLength - s.placeholderLength
    }
    n += bodyStart
    // Count removed CRs whose LF comes before n.
    let lo = 0, hi = crlf.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (crlf[mid]! < n) lo = mid + 1
      else hi = mid
    }
    return n + lo
  }
}

export function parse(source: string): DocumentNode {
  return parseWithSpans(source).document
}

/**
 * parse(), plus where each top-level node sits in `source` (OSS spec §11.7).
 * `children[i]` is the span of `document.children[i]`; a scene's span runs
 * from its heading line to the end of its last block. The text between spans
 * is only blank lines, so cutting `source` at the start of every section and
 * scene heading gives pieces that join back to `source` exactly.
 */
export function parseWithSpans(source: string): ParseWithSpansResult {
  const normalized = source.replace(/\r\n/g, '\n')
  const frontmatter = parseFrontmatter(normalized)
  const bodyStart = frontmatter ? frontmatter.raw.length : 0
  const rawBody = normalized.slice(bodyStart)
  // Multi-line <!-- ... --> comments (including ones spanning a blank line)
  // are extracted before block-splitting so they're never fragmented or
  // classified by only their first line — see comments.ts.
  const { body, comments, shifts } = extractComments(rawBody)
  const toSource = offsetMapper(source, bodyStart, shifts)
  // Blank-line count is normalized: serializer emits exactly \n\n between blocks
  const blocks = splitBlocks(body)
  const children: ContentNode[] = []
  const spans: SourceSpan[] = []
  const spanOf = (from: Block, to: Block): SourceSpan =>
    ({ start: toSource(blockSpan(from).start), end: toSource(blockSpan(to).end) })
  let i = 0
  // Tracks whether we're currently inside a {#characters}/"# Characters"
  // registry section, so @cue blocks there parse trailing "& key: value"
  // lines as metadata instead of dialogue (§8.2) — cleared on the next
  // section or scene-heading, mirroring the loop below that already stops
  // collecting a scene's content at those same boundaries.
  let inCharacterRegistry = false
  while (i < blocks.length) {
    const block = blocks[i]!.text
    const firstLine = block.split('\n').find(l => l.trim() !== '') ?? ''
    const firstToken = tokenize(firstLine)[0]!

    if (firstToken.type === 'scene-heading') {
      inCharacterRegistry = false
      const headingBlock = blocks[i]!
      // Collect this block plus all following non-heading blocks as scene children
      const sceneLines = block.split('\n').filter(l => l.trim() !== '')
      i++
      // Heading line + metadata; metadata may continue in following blocks
      // separated by blank lines, as long as the script body has not begun (§11.1).
      const { metadata, next: li } = collectMetadata(sceneLines, 1)
      const headingRaw = [sceneLines.slice(0, li).join('\n')]
      if (li === sceneLines.length) {
        while (i < blocks.length && isMetadataBlock(blocks[i]!.text)) {
          const metaLines = blocks[i]!.text.split('\n').filter(l => l.trim() !== '')
          metadata.push(...collectMetadata(metaLines, 0).metadata)
          headingRaw.push(metaLines.join('\n'))
          i++
        }
      }
      const contentBlocks: string[] = []
      while (i < blocks.length) {
        const nextBlock = blocks[i]!.text
        const nextFirstLine = nextBlock.split('\n').find(l => l.trim() !== '') ?? ''
        const nextFirstToken = tokenize(nextFirstLine)[0]!
        if (nextFirstToken.type === 'scene-heading' || nextFirstToken.type === 'section') break
        contentBlocks.push(nextBlock)
        i++
      }
      // raw covers only the heading line + metadata; body lines that share
      // the heading's block are the scene's first child and carry their own raw.
      const heading: SceneHeadingNode = {
        type: 'scene-heading', raw: headingRaw.join('\n\n'),
        text: firstToken.text ?? '',
        id: firstToken.id ?? null,
        attrs: firstToken.attrs ?? [],
        metadata, children: [],
      }
      // The remaining lines from the heading block + content blocks become scene children
      const remainingHeadingLines = sceneLines.slice(li)
      const allContentLines = [
        ...remainingHeadingLines,
        ...contentBlocks.flatMap(b => ['', ...b.split('\n')]),
      ]
      heading.children = parseSceneContent(allContentLines, comments)
      children.push(heading)
      spans.push(spanOf(headingBlock, blocks[i - 1]!))
    } else {
      const node = parseBlock(block, comments, inCharacterRegistry)
      if (node) {
        children.push(node)
        spans.push(spanOf(blocks[i]!, blocks[i]!))
      }
      if (node && node.type === 'section') {
        inCharacterRegistry = isCharacterRegistrySection(node.id, node.text)
      }
      i++
    }
  }
  let frontmatterSpan: SourceSpan | null = null
  if (frontmatter) {
    // Up to the end of the closing --- line, before its line break.
    let end = toSource(0)
    if (source[end - 1] === '\n') end--
    if (source[end - 1] === '\r') end--
    frontmatterSpan = { start: 0, end }
  }
  return {
    document: { type: 'document', frontmatter, children },
    frontmatter: frontmatterSpan,
    children: spans,
  }
}
