import { parse } from '@sutrata/parser'
import type { Node as PmNode } from 'prosemirror-model'
import { buildSceneList } from './scene-list'
import { getEditorView, getSourceView } from '../editor/editor-bus'
import { sutraToProsemirror } from '../editor/sutra-to-prosemirror'

/**
 * Text-level scene edits used by the navigator (renumber, omit, restore),
 * and applyTextEdit, which puts the result into whichever editor is mounted
 * as ONE undoable change.
 */

const META = /^&\s+[A-Za-z0-9_-]+:/
const LIST_ITEM = /^\s+-(\s|$)/

interface SceneSpan { start: number; end: number }

function sceneSpans(text: string): SceneSpan[] {
  const scenes = buildSceneList(text)
  return scenes.map((s, i) => ({ start: s.textOffset, end: scenes[i + 1]?.textOffset ?? text.length }))
}

/**
 * Split a scene's text into its heading block (heading + metadata, which may
 * be separated by blank lines), its body, and anything from a following
 * section heading on (sections end a scene's content).
 */
function splitScene(segment: string): { head: string[]; body: string; rest: string } {
  const lines = segment.split('\n')
  let headEnd = 1
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]!
    if (META.test(l.trim()) || LIST_ITEM.test(l)) headEnd = i + 1
    else if (l.trim() !== '') break
  }
  let bodyEnd = lines.length
  for (let i = headEnd; i < lines.length; i++) {
    if (/^#(\s|$)/.test(lines[i]!)) { bodyEnd = i; break }
  }
  return {
    head: lines.slice(0, headEnd).filter(l => l.trim() !== ''),
    body: lines.slice(headEnd, bodyEnd).join('\n').trim(),
    rest: lines.slice(bodyEnd).join('\n').trim(),
  }
}

function joinScene(head: string[], body: string, rest: string, isLast: boolean): string {
  return [head.join('\n'), body, rest].filter(Boolean).join('\n\n') + (isLast ? '\n' : '\n\n')
}

/**
 * Set (replace or add) `& key: value` in a heading block; null removes it.
 * A new line goes right under the heading (`first`) or after the existing
 * metadata (`last`).
 */
function setMeta(head: string[], key: string, value: string | null, where: 'first' | 'last' = 'first'): string[] {
  const re = new RegExp(`^&\\s+${key}:`)
  const idx = head.findIndex(l => re.test(l.trim()))
  const line = value === null ? null : `& ${key}: ${value}`
  if (idx >= 0) return line === null ? head.filter((_, i) => i !== idx) : head.map((l, i) => (i === idx ? line : l))
  if (line === null) return head
  return where === 'first' ? [head[0]!, line, ...head.slice(1)] : [...head, line]
}

function editScenes(text: string, edit: (index: number, parts: ReturnType<typeof splitScene>) => ReturnType<typeof splitScene> | null): string {
  const spans = sceneSpans(text)
  let out = text
  for (let i = spans.length - 1; i >= 0; i--) {
    const { start, end } = spans[i]!
    const parts = edit(i, splitScene(out.slice(start, end)))
    if (!parts) continue
    out = out.slice(0, start) + joinScene(parts.head, parts.body, parts.rest, end === text.length) + out.slice(end)
  }
  return out
}

/** Write `numbers[i]` as scene i's `& number:`. */
export function setSceneNumbersInText(text: string, numbers: readonly string[]): string {
  return editScenes(text, (i, parts) => ({ ...parts, head: setMeta(parts.head, 'number', numbers[i] ?? null) }))
}

/**
 * Omit a scene (§7.4): keep its heading and number, set `& status: omitted`,
 * and keep its body inside a comment so it can be restored.
 */
export function omitSceneInText(text: string, index: number): string {
  return editScenes(text, (i, parts) => i !== index ? null : {
    head: setMeta(parts.head, 'status', 'omitted', 'last'),
    body: parts.body ? `<!-- ${parts.body.replace(/-->/g, '-- >')} -->` : '',
    rest: parts.rest,
  })
}

/** Undo omitSceneInText: drop `& status: omitted` and unwrap a body kept in a comment. */
export function restoreSceneInText(text: string, index: number): string {
  return editScenes(text, (i, parts) => {
    if (i !== index) return null
    const m = /^<!--\s?([\s\S]*?)\s?-->$/.exec(parts.body)
    return { head: setMeta(parts.head, 'status', null), body: m ? m[1]!.trim() : parts.body, rest: parts.rest }
  })
}

/**
 * Replace the document text with `next` as one undoable edit. In the
 * formatted editor only the top-level blocks that changed are replaced, so
 * the caret, scroll and history stay meaningful.
 */
export function applyTextEdit(next: string, setText: (t: string) => void): void {
  const view = getEditorView()
  if (view) {
    const target = sutraToProsemirror(parse(next))
    const doc = view.state.doc
    const a: PmNode[] = []
    const b: PmNode[] = []
    doc.forEach(n => a.push(n))
    target.forEach(n => b.push(n))
    let head = 0
    while (head < a.length && head < b.length && a[head]!.eq(b[head]!)) head++
    let tail = 0
    while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail]!.eq(b[b.length - 1 - tail]!)) tail++
    if (head === a.length && head === b.length) return
    const posOf = (nodes: PmNode[], index: number) => nodes.slice(0, index).reduce((p, n) => p + n.nodeSize, 0)
    const from = posOf(a, head)
    const to = posOf(a, a.length - tail)
    view.dispatch(view.state.tr.replaceWith(from, to, b.slice(head, b.length - tail)))
    return
  }
  const source = getSourceView()
  if (source) {
    source.dispatch({ changes: { from: 0, to: source.state.doc.length, insert: next } })
    return
  }
  setText(next)
}
