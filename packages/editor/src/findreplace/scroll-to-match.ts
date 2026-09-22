import type { Node } from 'prosemirror-model'
import { getEditorView } from '../editor/editor-bus'

/**
 * Walk the PM doc once and return:
 * - `text`: flat concatenation of all text node content (no sigils, no blank lines)
 * - `pmPositions`: parallel array where pmPositions[i] is the PM doc position
 *   corresponding to character i in `text`
 */
export function buildPmTextMap(doc: Node): { text: string; pmPositions: number[] } {
  const chars: string[] = []
  const pmPositions: number[] = []

  doc.nodesBetween(0, doc.content.size, (node, pmPos) => {
    if (node.isText) {
      const t = node.text!
      for (let i = 0; i < t.length; i++) {
        chars.push(t[i]!)
        pmPositions.push(pmPos + i)
      }
    }
    return true
  })

  return { text: chars.join(''), pmPositions }
}

export interface PmMatch {
  start: number   // index into PM text map
  end: number
  pmFrom: number  // PM doc position
  pmTo: number
  text: string
}

export function findInPmDoc(
  doc: Node,
  query: string,
  options: { caseSensitive?: boolean } = {},
): PmMatch[] {
  if (!query) return []
  const { text, pmPositions } = buildPmTextMap(doc)
  if (!text) return []

  const { caseSensitive = false } = options
  const haystack = caseSensitive ? text : text.toLowerCase()
  const needle   = caseSensitive ? query : query.toLowerCase()

  const matches: PmMatch[] = []
  let searchFrom = 0
  while (searchFrom < haystack.length) {
    const idx = haystack.indexOf(needle, searchFrom)
    if (idx === -1) break
    const end = idx + needle.length
    matches.push({
      start: idx,
      end,
      pmFrom: pmPositions[idx]!,
      pmTo:   pmPositions[end - 1]! + 1,
      text: text.slice(idx, end),
    })
    searchFrom = idx + 1
  }
  return matches
}

/**
 * Scroll the editor so the given match is visible.
 * Highlighting is handled by the find-highlight plugin (decorations) — no selection
 * dispatch here so focus stays in the find input.
 */
export function scrollToPmMatch(match: PmMatch): void {
  const view = getEditorView()
  if (!view) return
  try {
    const domNode = view.nodeDOM(match.pmFrom)
    const el = domNode instanceof Element ? domNode : (domNode as Element | null)?.parentElement
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch {
    // At doc boundary — ignore
  }
}

/** Legacy: maps a flat text-space offset to PM position. Used by tests only. */
export function textOffsetToPmPos(doc: Node, textOffset: number): number | null {
  const { pmPositions } = buildPmTextMap(doc)
  if (textOffset >= pmPositions.length) return null
  return pmPositions[textOffset] ?? null
}
