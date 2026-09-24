import { parse } from '@sutrata/parser'
import type { AIProvider } from '../extensions/ai-provider'
import { IMPORT_FORMAT_SYSTEM_PROMPT } from '../ai/prompts'

/**
 * AI-assisted import of screenplays written elsewhere (OSS spec §5.5).
 *
 * The source is split into chunks at blank lines (preferring likely scene
 * boundaries), each chunk is formatted by the injected AIProvider, and every
 * result is checked: it must parse to at least one block, and its words must
 * match the chunk's words. A failing chunk is retried once; if it still
 * fails, the better attempt is kept and the problem is reported.
 */

/** Target chunk size in characters: big enough for context, small enough for any provider. */
export const DEFAULT_CHUNK_CHARS = 6000

/** A line that probably starts a scene: sluglines in Latin script, "SCENE 12", or a Sutra/Markdown heading. */
const LIKELY_SCENE = /^\s*(?:##?\s|\.?(?:INT|EXT|INT\.?\/EXT|I\/E)[.\s]|SCENE\s+\d|\d+[A-Z]?[.)]?\s+(?:INT|EXT)[.\s])/i

/** Split `text` into paragraphs (blank-line separated) and group them into chunks of about `maxChars`. */
export function chunkSource(text: string, maxChars = DEFAULT_CHUNK_CHARS): string[] {
  const paragraphs = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map(p => p.replace(/^\n+|\n+$/g, '')).filter(p => p.trim())
  const pieces: string[] = []
  for (const p of paragraphs) {
    if (p.length <= maxChars) { pieces.push(p); continue }
    // An oversized paragraph is split at line boundaries.
    let current: string[] = []
    let size = 0
    for (const line of p.split('\n')) {
      if (size + line.length > maxChars && current.length) {
        pieces.push(current.join('\n'))
        current = []
        size = 0
      }
      current.push(line)
      size += line.length + 1
    }
    if (current.length) pieces.push(current.join('\n'))
  }

  const chunks: string[] = []
  let current: string[] = []
  let size = 0
  for (const piece of pieces) {
    const full = size + piece.length > maxChars
    // Past half the budget, break early at a scene boundary rather than mid-scene.
    const sceneBreak = size > maxChars / 2 && LIKELY_SCENE.test(piece)
    if (current.length && (full || sceneBreak)) {
      chunks.push(current.join('\n\n'))
      current = []
      size = 0
    }
    current.push(piece)
    size += piece.length + 2
  }
  if (current.length) chunks.push(current.join('\n\n'))
  return chunks
}

/** Words for the content comparison: letters/marks/digits, NFC, case-folded. Sigils and punctuation don't count. */
export function contentWords(text: string): string[] {
  // Attribute blocks ({#12}, {lang=hi}) are Sutra markup, not content.
  const stripped = text.normalize('NFC').replace(/\{[^{}\n]*\}/g, ' ')
  return (stripped.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).map(w => w.toLocaleLowerCase())
}

export interface ContentDiff {
  /** Words in the source missing from the result (with multiplicity). */
  dropped: string[]
  /** Words in the result not in the source. */
  added: string[]
}

export function compareContent(source: string, result: string): ContentDiff {
  const count = (words: string[]) => {
    const m = new Map<string, number>()
    for (const w of words) m.set(w, (m.get(w) ?? 0) + 1)
    return m
  }
  const a = count(contentWords(source))
  const b = count(contentWords(result))
  const diff = (x: Map<string, number>, y: Map<string, number>) =>
    [...x].flatMap(([w, n]) => Array<string>(Math.max(0, n - (y.get(w) ?? 0))).fill(w))
  return { dropped: diff(a, b), added: diff(b, a) }
}

/** Page furniture a formatter may legitimately drop. */
const FURNITURE = new Set(['continued', 'cont', 'd', 'more'])

/** Whether a diff is small enough to accept: page numbers and furniture aside, nothing changed. */
function acceptable(diff: ContentDiff): boolean {
  const significant = (w: string) => !FURNITURE.has(w) && !/^\d+$/.test(w)
  return !diff.dropped.some(significant) && !diff.added.some(significant)
}

/** Strip a code fence or stray frontmatter a model might wrap around its answer. */
export function cleanImportOutput(raw: string): string {
  let out = raw.trim().replace(/^```[\w-]*\n/, '').replace(/\n```\s*$/, '')
  if (out.startsWith('---\n')) {
    const end = out.indexOf('\n---', 4)
    if (end !== -1) out = out.slice(end + 4)
  }
  return out.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export interface ChunkResult {
  index: number
  source: string
  output: string
  attempts: number
  /** Why the chunk's output may not be faithful; empty when it passed. */
  problems: string[]
  diff: ContentDiff
}

function problemsOf(output: string, diff: ContentDiff): string[] {
  const problems: string[] = []
  if (!output) problems.push('The AI returned nothing for this part.')
  else if (parse(output).children.length === 0) problems.push('The AI output is not a Sutra screenplay.')
  const shown = (ws: string[]) => [...new Set(ws)].slice(0, 8).join(', ')
  if (!acceptable(diff)) {
    if (diff.dropped.length) problems.push(`Missing from the result (${diff.dropped.length}): ${shown(diff.dropped)}`)
    if (diff.added.length) problems.push(`Not in the source (${diff.added.length}): ${shown(diff.added)}`)
  }
  return problems
}

export async function formatChunk(ai: AIProvider, source: string, index: number, signal?: AbortSignal): Promise<ChunkResult> {
  let best: ChunkResult | null = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    signal?.throwIfAborted()
    const output = cleanImportOutput(await ai.complete({ system: IMPORT_FORMAT_SYSTEM_PROMPT, prompt: source, signal }))
    const diff = compareContent(source, output)
    const result: ChunkResult = { index, source, output, attempts: attempt, problems: problemsOf(output, diff), diff }
    if (result.problems.length === 0) return result
    const size = (r: ChunkResult) => r.diff.dropped.length + r.diff.added.length + (r.output ? 0 : 1e9)
    if (!best || size(result) < size(best)) best = { ...result }
    best.attempts = attempt
  }
  return best!
}

export interface ImportResult {
  /** The formatted Sutra body, chunks joined with blank lines. */
  sutra: string
  chunks: ChunkResult[]
}

export async function runAiImport(
  ai: AIProvider,
  sourceText: string,
  opts: { signal?: AbortSignal; maxChars?: number; onProgress?(done: number, total: number): void } = {},
): Promise<ImportResult> {
  const sources = chunkSource(sourceText, opts.maxChars)
  const chunks: ChunkResult[] = []
  opts.onProgress?.(0, sources.length)
  for (const [i, source] of sources.entries()) {
    chunks.push(await formatChunk(ai, source, i, opts.signal))
    opts.onProgress?.(i + 1, sources.length)
  }
  return { sutra: chunks.map(c => c.output).filter(Boolean).join('\n\n'), chunks }
}

// ── Review: per-block element types ──────────────────────────────────────────

export type BlockKind = 'scene_heading' | 'action' | 'character' | 'transition' | 'centered' | 'lyrics' | 'note' | 'section' | 'other'

/** Split Sutra text into blank-line separated blocks (multi-line comments kept whole). */
export function splitBlocks(sutra: string): string[] {
  const blocks: string[] = []
  let current: string[] = []
  let inComment = false
  for (const line of sutra.split('\n')) {
    if (!line.trim() && !inComment) {
      if (current.length) blocks.push(current.join('\n'))
      current = []
      continue
    }
    current.push(line)
    if (line.includes('<!--') && !line.includes('-->')) inComment = true
    else if (inComment && line.includes('-->')) inComment = false
  }
  if (current.length) blocks.push(current.join('\n'))
  return blocks
}

export function blockKind(block: string): BlockKind {
  const node = parse(block + '\n').children[0]
  switch (node?.type) {
    case 'scene-heading': return 'scene_heading'
    case 'section': return 'section'
    case 'action': return 'action'
    case 'character': case 'dual-dialogue': return 'character'
    case 'transition': return 'transition'
    case 'centered': return 'centered'
    case 'lyrics': return 'lyrics'
    case 'note': return 'note'
    default: return 'other'
  }
}

/** A block's text without its Sutra sigils, one entry per line. */
function plainLines(block: string): string[] {
  return block.split('\n').map(l => l.trim()
    .replace(/^(?:##|#|@|>>|~)\s*/, '')
    .replace(/\s*<<$/, '')
    .replace(/^\[\[\s*(.*?)\s*\]\]$/, '$1'))
    .filter(Boolean)
}

/** Rewrite `block` as element `kind`, keeping its words (and a heading's metadata lines). */
export function retypeBlock(block: string, kind: BlockKind): string {
  if (kind === 'other') return block
  const lines = plainLines(block)
  const [first = '', ...rest] = lines
  switch (kind) {
    case 'scene_heading': {
      const meta = rest.filter(l => l.startsWith('& '))
      const body = rest.filter(l => !l.startsWith('& '))
      return [`## ${[first, ...body].join(' ')}`, ...meta].join('\n')
    }
    case 'section': return `# ${lines.join(' ')}`
    case 'action': return lines.join('\n')
    case 'character': return [`@${first}`, ...rest].join('\n')
    case 'transition': return lines.map(l => `>> ${l}`).join('\n')
    case 'centered': return lines.map(l => `>> ${l} <<`).join('\n')
    case 'lyrics': return lines.map(l => `~ ${l}`).join('\n')
    case 'note': return `[[ ${lines.join(' ')} ]]`
  }
}
