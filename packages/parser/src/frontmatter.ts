import type { FrontmatterNode } from './types.js'

const FENCE = '---'

function parseYaml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = text.split('\n').map(l => l.endsWith('\r') ? l.slice(0, -1) : l)
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (!keyMatch) { i++; continue }
    const key = keyMatch[1]!
    const val = keyMatch[2]!.trim()
    if (val === '|') {
      // Literal block scalar: collect indented lines, join with \n, strip trailing newline
      i++
      const blockLines: string[] = []
      while (i < lines.length && (lines[i] ?? '').match(/^\s/)) {
        blockLines.push((lines[i]!).replace(/^  /, ''))
        i++
      }
      // Strip single trailing empty line (YAML chomping default "clip")
      while (blockLines.length > 0 && blockLines[blockLines.length - 1] === '') blockLines.pop()
      result[key] = blockLines.join('\n')
    } else if (val === '') {
      const nested: Record<string, string> = {}
      i++
      while (i < lines.length && (lines[i] ?? '').match(/^\s+\S/)) {
        const nline = lines[i]!
        const nm = nline.match(/^\s+([a-zA-Z0-9_-]+):\s*(.+)$/)
        if (nm) nested[nm[1]!] = nm[2]!.trim()
        i++
      }
      result[key] = Object.keys(nested).length > 0 ? nested : ''
    } else {
      result[key] = val
      i++
    }
  }
  return result
}

export function parseFrontmatter(source: string): FrontmatterNode | null {
  let openEnd: number
  if (source.startsWith(FENCE + '\r\n')) {
    openEnd = FENCE.length + 2  // skip ---\r\n
  } else if (source.startsWith(FENCE + '\n')) {
    openEnd = FENCE.length + 1  // skip ---\n
  } else {
    return null
  }

  const rest = source.slice(openEnd)
  const closeIdx = rest.indexOf('\n' + FENCE)
  if (closeIdx === -1) return null

  const yamlText = rest.slice(0, closeIdx)
  // Determine end of closing fence line (---\n or ---\r\n or --- at EOF)
  const afterClose = openEnd + closeIdx + 1 + FENCE.length // points past closing ---
  let rawLength = afterClose
  if (source[afterClose] === '\r' && source[afterClose + 1] === '\n') {
    rawLength += 2
  } else if (source[afterClose] === '\n') {
    rawLength += 1
  }
  // If no trailing newline (EOF), rawLength stays at afterClose (just past ---)

  const raw = source.slice(0, rawLength)

  return {
    type: 'frontmatter',
    raw,
    data: parseYaml(yamlText),
  }
}

export function serializeFrontmatter(node: FrontmatterNode): string {
  return node.raw
}
