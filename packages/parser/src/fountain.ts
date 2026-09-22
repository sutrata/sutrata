import type {
  DocumentNode, ContentNode, SceneHeadingNode, SceneContentNode,
  CharacterNode, ActionNode, DialogueNode, ParentheticalNode,
  TransitionNode, CenteredNode, FountainImportResult, FountainExportResult,
} from './types.js'

// Fountain scene heading: starts with INT./EXT./etc. or a forced . prefix
const FTN_SCENE = /^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.?)\s+/i
const FTN_FORCED_SCENE = /^\./
// Fountain transition: ends with TO: (single line block)
const FTN_TRANSITION_SUFFIX = /\bTO:\s*$/
// Fountain centered: >text<
const FTN_CENTERED = /^>\s*(.+?)\s*<\s*$/

function isFountainSceneHeading(line: string): boolean {
  return FTN_SCENE.test(line) || FTN_FORCED_SCENE.test(line)
}

function isAllCaps(line: string): boolean {
  const t = line.trim()
  return t.length > 0 && t === t.toUpperCase() && /[A-Z]/.test(t)
}

export function importFountain(source: string): FountainImportResult {
  const warnings: string[] = []
  const normalized = source.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')

  // Parse Fountain title page: key: value lines at top, terminated by first blank line.
  // Continuation lines are indented (start with whitespace) and appended to the last key.
  let bodyStart = 0
  const frontmatterData: Record<string, string> = {}
  let hasTitlePage = false
  let lastKey: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.trim() === '') { bodyStart = i + 1; break }
    const m = line.match(/^([A-Za-z][A-Za-z ]*?):\s*(.*)$/)
    if (m) {
      lastKey = m[1]!.toLowerCase().trim()
      frontmatterData[lastKey] = m[2]!.trim()
      hasTitlePage = true
    } else if (lastKey && /^\s+/.test(line)) {
      // Indented continuation — append to last key
      const continuation = line.trim()
      if (continuation) {
        frontmatterData[lastKey] = frontmatterData[lastKey]
          ? `${frontmatterData[lastKey]} ${continuation}`
          : continuation
      }
    } else {
      // Not a title page line — treat everything as body
      bodyStart = 0
      hasTitlePage = false
      break
    }
  }

  const bodyLines = lines.slice(bodyStart)
  const blocks = bodyLines.join('\n').split(/\n\n+/).filter(b => b.trim())
  const children: ContentNode[] = []
  let currentScene: SceneHeadingNode | null = null

  for (const block of blocks) {
    const blockLines = block.split('\n').filter(l => l.trim() !== '')
    if (blockLines.length === 0) continue
    const first = blockLines[0]!.trim()

    // Centered: >text<
    const centeredMatch = first.match(FTN_CENTERED)
    if (centeredMatch) {
      const node: CenteredNode = { type: 'centered', raw: block, text: centeredMatch[1]!.trim() }
      if (currentScene) currentScene.children.push(node)
      else children.push(node)
      continue
    }

    // Scene heading
    if (isFountainSceneHeading(first)) {
      // Strip leading forced `.`, trailing Fountain scene number `#num#`, and trim
      const sceneNumMatch = first.match(/^(.*?)\s*#([^#]+)#\s*$/)
      const headingText = (sceneNumMatch ? sceneNumMatch[1]! : first)
        .replace(/^\./, '').trim()
      const sceneId = sceneNumMatch ? sceneNumMatch[2]!.trim() : null
      const heading: SceneHeadingNode = {
        type: 'scene-heading', raw: block,
        text: headingText,
        id: sceneId, metadata: [], children: [],
      }
      children.push(heading)
      currentScene = heading
      continue
    }
    // Synopsis: = text
    if (first.startsWith('=')) {
      if (currentScene) {
        const val = first.slice(1).trim()
        currentScene.metadata.push({
          type: 'scene-metadata',
          raw: block,
          key: 'synopsis',
          value: val,
        })
      }
      continue
    }

    // Note: [[text]] lines — emit each [[]] line as a note, remainder as action
    if (first.startsWith('[[')) {
      const actionLines: string[] = []
      for (const noteLine of blockLines) {
        const trimmed = noteLine.trim()
        if (trimmed.startsWith('[[')) {
          const m = trimmed.match(/^\[\[\s*(.*?)\s*\]\]\s*$/)
          const text = m ? m[1]! : trimmed.replace(/^\[\[|\]\]$/g, '').trim()
          const noteNode = { type: 'note' as const, raw: noteLine, text }
          if (currentScene) currentScene.children.push(noteNode)
          else children.push(noteNode)
        } else {
          actionLines.push(noteLine)
        }
      }
      if (actionLines.length > 0) {
        const actionText = actionLines.map(l => l.startsWith('!') ? l.slice(1) : l).join('\n')
        const actionNode: ActionNode = {
          type: 'action', raw: actionLines.join('\n'),
          spans: [{ type: 'text', text: actionText }],
        }
        if (currentScene) currentScene.children.push(actionNode)
        else children.push(actionNode)
      }
      continue
    }

    // Transition: single-line block ending with TO:
    if (blockLines.length === 1 && FTN_TRANSITION_SUFFIX.test(first)) {
      const node: TransitionNode = { type: 'transition', raw: block, text: first.trim() }
      if (currentScene) currentScene.children.push(node)
      else children.push(node)
      continue
    }

    // Character + dialogue: first line is ALL CAPS or @-forced, followed by dialogue lines
    const isForcedChar = first.startsWith('@')
    const cueLine = isForcedChar ? first.slice(1) : first
    const isDualCue = cueLine.trimEnd().endsWith('^')
    const cueStripped = isDualCue ? cueLine.trimEnd().slice(0, -1).trim() : cueLine.trim()
    if (blockLines.length >= 2 && (isForcedChar || isAllCaps(first))) {
      const extMatch = cueStripped.match(/^(.+?)\s+(\([^)]+\))\s*$/)
      const charNode: CharacterNode = {
        type: 'character', raw: block,
        name: extMatch ? extMatch[1]!.trim() : cueStripped,
        extension: extMatch ? extMatch[2]! : null,
        isDual: isDualCue, children: [],
      }
      for (let i = 1; i < blockLines.length; i++) {
        const dl = blockLines[i]!.trim()
        if (dl.startsWith('(') && dl.endsWith(')')) {
          charNode.children.push({
            type: 'parenthetical', raw: blockLines[i]!,
            text: dl.slice(1, -1).trim(),
          } as ParentheticalNode)
        } else {
          charNode.children.push({
            type: 'dialogue', raw: blockLines[i]!,
            spans: [{ type: 'text', text: dl }],
          } as DialogueNode)
        }
      }
      if (currentScene) currentScene.children.push(charNode)
      else children.push(charNode)
      continue
    }

    // Default: action. Strip leading `!` (Fountain forced-action prefix — unnecessary in Sutra)
    const actionText = blockLines.map(l => l.startsWith('!') ? l.slice(1) : l).join('\n')
    const actionNode: ActionNode = {
      type: 'action', raw: block,
      spans: [{ type: 'text', text: actionText }],
    }
    if (currentScene) currentScene.children.push(actionNode)
    else children.push(actionNode)
  }

  const document: DocumentNode = {
    type: 'document',
    frontmatter: hasTitlePage ? {
      type: 'frontmatter',
      raw: lines.slice(0, bodyStart).join('\n') + '\n',
      data: frontmatterData,
    } : null,
    children,
  }

  return { document, warnings }
}

/**
 * Converts a DocumentNode produced by importFountain into a Sutra text string.
 * Uses the structured AST fields (not node.raw, which contains Fountain syntax).
 */
export function fountainDocToSutra(doc: DocumentNode): string {
  const parts: string[] = []

  if (doc.frontmatter) {
    parts.push('---')
    const d = doc.frontmatter.data as Record<string, unknown>
    for (const [key, val] of Object.entries(d)) {
      if (val != null && val !== '') parts.push(`${key}: ${val}`)
    }
    parts.push('---')
    parts.push('')
  }

  function sceneContentToSutra(nodes: SceneContentNode[]): void {
    for (const n of nodes) {
      if (n.type === 'action') {
        parts.push(n.spans.map(s => s.type === 'text' ? s.text : '').join(''))
        parts.push('')
      } else if (n.type === 'character') {
        const ext = n.extension ? ` ${n.extension}` : ''
        const dual = n.isDual ? ' ^' : ''
        parts.push(`@${n.name}${ext}${dual}`)
        for (const c of n.children) {
          if (c.type === 'parenthetical') parts.push(`(${c.text})`)
          else parts.push(c.spans.map(s => s.type === 'text' ? s.text : '').join(''))
        }
        parts.push('')
      } else if (n.type === 'transition') {
        parts.push(`>> ${n.text}`)
        parts.push('')
      } else if (n.type === 'centered') {
        parts.push(`>> ${n.text} <<`)
        parts.push('')
      } else if (n.type === 'note') {
        parts.push(`[[ ${n.text} ]]`)
        parts.push('')
      } else if (n.type === 'comment') {
        parts.push(`<!-- ${n.text} -->`)
        parts.push('')
      }
    }
  }

  for (const node of doc.children) {
    if (node.type === 'scene-heading') {
      const id = node.id ? ` {#${node.id}}` : ''
      parts.push(`## ${node.text}${id}`)
      parts.push('')
      sceneContentToSutra(node.children)
    } else if (node.type === 'action') {
      parts.push(node.spans.map(s => s.type === 'text' ? s.text : '').join(''))
      parts.push('')
    } else if (node.type === 'character') {
      const ext = node.extension ? ` ${node.extension}` : ''
      const dual = node.isDual ? ' ^' : ''
      parts.push(`@${node.name}${ext}${dual}`)
      for (const c of node.children) {
        if (c.type === 'parenthetical') parts.push(`(${c.text})`)
        else parts.push(c.spans.map(s => s.type === 'text' ? s.text : '').join(''))
      }
      parts.push('')
    } else if (node.type === 'transition') {
      parts.push(`>> ${node.text}`)
      parts.push('')
    } else if (node.type === 'centered') {
      parts.push(`>> ${node.text} <<`)
      parts.push('')
    } else if (node.type === 'note') {
      parts.push(`[[ ${node.text} ]]`)
      parts.push('')
    } else if (node.type === 'comment') {
      parts.push(`<!-- ${node.text} -->`)
      parts.push('')
    }
  }

  return parts.join('\n').trimEnd() + '\n'
}

export function exportFountain(doc: DocumentNode): FountainExportResult {
  const warnings: string[] = []
  const parts: string[] = []

  if (doc.frontmatter) {
    const d = doc.frontmatter.data as Record<string, unknown>
    if (d['title']) parts.push(`Title: ${d['title']}`)
    if (d['author']) parts.push(`Author: ${d['author']}`)
    parts.push('')  // blank line after title page
    parts.push('')
  }

  function serializeSceneContent(nodes: SceneContentNode[]): string[] {
    const out: string[] = []
    for (const n of nodes) {
      if (n.type === 'action') {
        out.push(n.spans.map(s => s.type === 'text' ? s.text : '').join(''))
      } else if (n.type === 'character') {
        const ext = n.extension ? ` ${n.extension}` : ''
        const charLines = [`@${n.name}${ext}`]
        for (const c of n.children) {
          if (c.type === 'parenthetical') charLines.push(`(${c.text})`)
          else charLines.push(c.spans.map(s => s.type === 'text' ? s.text : '').join(''))
        }
        out.push(charLines.join('\n'))
      } else if (n.type === 'transition') {
        out.push(n.text.endsWith('TO:') ? n.text : `> ${n.text}`)
      } else if (n.type === 'centered') {
        out.push(`>${n.text}<`)
      } else if (n.type === 'note') {
        // notes have no Fountain equivalent — drop silently (warned at scene level)
      } else if (n.type === 'comment') {
        out.push(`/* ${n.text} */`)
      }
      // page-break, lyrics, dual-dialogue: dropped
    }
    return out
  }

  for (const node of doc.children) {
    if (node.type === 'scene-heading') {
      const synopsisNode = node.metadata.find(m => m.key === 'synopsis')
      const otherMeta = node.metadata.filter(m => m.key !== 'synopsis')
      if (otherMeta.length > 0) {
        warnings.push(`metadata dropped in Fountain export for scene "${node.text}"`)
      }
      parts.push(node.text)
      if (synopsisNode) {
        parts.push('')
        parts.push(`= ${synopsisNode.value}`)
      }
      const contentLines = serializeSceneContent(node.children)
      for (const line of contentLines) {
        parts.push('')
        parts.push(line)
      }
    } else if (node.type === 'section') {
      // sections have no Fountain equivalent — silently dropped
    } else if (node.type === 'action') {
      parts.push(node.spans.map(s => s.type === 'text' ? s.text : '').join(''))
    } else if (node.type === 'transition') {
      parts.push('')
      parts.push(node.text.endsWith('TO:') ? node.text : `> ${node.text}`)
    } else if (node.type === 'centered') {
      parts.push(`>${node.text}<`)
    }
    parts.push('')
  }

  return { text: parts.join('\n').trimEnd() + '\n', warnings }
}
