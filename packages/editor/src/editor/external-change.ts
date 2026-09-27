import type { Node } from 'prosemirror-model'
import type { EditorState, Transaction } from 'prosemirror-state'

/** Transaction meta marking a change that came from storage, not the user. */
export const EXTERNAL_CHANGE = 'sutrataExternalChange'

/** Above this many block pairs the diff gives up and replaces the whole changed middle. */
const MAX_DIFF_CELLS = 4_000_000

interface Run { aFrom: number; aTo: number; bFrom: number; bTo: number }

/**
 * A transaction turning `state.doc` into `next` that replaces only the
 * top-level blocks that differ (a block whose only change is its attributes
 * keeps its content), so the selection in untouched blocks stays where it is.
 * Kept out of undo history and marked EXTERNAL_CHANGE. Null if they are equal.
 */
export function externalChange(state: EditorState, next: Node): Transaction | null {
  if (state.doc.eq(next)) return null
  const a = children(state.doc)
  const b = children(next)

  let start = 0
  while (start < a.length && start < b.length && a[start]!.eq(b[start]!)) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1]!.eq(b[endB - 1]!)) { endA--; endB-- }

  const runs = diffRuns(a, b, start, endA, start, endB)
  const posA = offsets(a)
  const posB = offsets(b)
  const tr = state.tr
  // Last run first, so earlier positions stay valid.
  for (const r of runs.reverse()) {
    const one = r.aTo - r.aFrom === 1 && r.bTo - r.bFrom === 1
    const x = a[r.aFrom]
    const y = b[r.bFrom]
    if (one && x && y && x.type === y.type && x.content.eq(y.content) && x.sameMarkup(y) === false &&
        y.type.validContent(x.content)) {
      tr.setNodeMarkup(posA[r.aFrom]!, undefined, y.attrs, y.marks)
    } else {
      tr.replace(posA[r.aFrom]!, posA[r.aTo]!, next.slice(posB[r.bFrom]!, posB[r.bTo]!))
    }
  }
  return tr.setMeta('addToHistory', false).setMeta(EXTERNAL_CHANGE, true)
}

function children(doc: Node): Node[] {
  const list: Node[] = []
  doc.forEach(n => { list.push(n) })
  return list
}

/** Start position of each top-level child, plus the end of the content. */
function offsets(nodes: Node[]): number[] {
  const pos = [0]
  for (const n of nodes) pos.push(pos.at(-1)! + n.nodeSize)
  return pos
}

/** Runs of unmatched blocks between a[aStart..aEnd) and b[bStart..bEnd), by longest common subsequence. */
function diffRuns(a: Node[], b: Node[], aStart: number, aEnd: number, bStart: number, bEnd: number): Run[] {
  const n = aEnd - aStart
  const m = bEnd - bStart
  if (n === 0 && m === 0) return []
  if (n === 0 || m === 0 || n * m > MAX_DIFF_CELLS) return [{ aFrom: aStart, aTo: aEnd, bFrom: bStart, bTo: bEnd }]

  // lcs[i][j]: LCS length of a[aStart+i..aEnd) and b[bStart+j..bEnd).
  const w = m + 1
  const lcs = new Uint32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = a[aStart + i]!.eq(b[bStart + j]!)
        ? lcs[(i + 1) * w + j + 1]! + 1
        : Math.max(lcs[(i + 1) * w + j]!, lcs[i * w + j + 1]!)
    }
  }

  const runs: Run[] = []
  let run: Run | null = null
  let i = 0
  let j = 0
  const extend = (di: number, dj: number) => {
    if (!run) run = { aFrom: aStart + i, aTo: aStart + i, bFrom: bStart + j, bTo: bStart + j }
    run.aTo += di
    run.bTo += dj
  }
  while (i < n || j < m) {
    if (i < n && j < m && a[aStart + i]!.eq(b[bStart + j]!)) {
      if (run) { runs.push(run); run = null }
      i++; j++
    } else if (j < m && (i === n || lcs[i * w + j + 1]! >= lcs[(i + 1) * w + j]!)) {
      extend(0, 1); j++
    } else {
      extend(1, 0); i++
    }
  }
  if (run) runs.push(run)
  return runs
}
