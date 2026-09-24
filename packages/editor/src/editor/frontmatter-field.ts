import type { EditorView } from 'prosemirror-view'
import { parse } from '@sutrata/parser'
import { schema } from './schema'
import { sutraToProsemirror } from './sutra-to-prosemirror'

/**
 * Sets a single flat (non-dotted) top-level frontmatter key, e.g. `style: classic`.
 * Mirrors StatisticsDialog.tsx's actor-name updater (dotted-key, nested-map case) but
 * for the simpler flat-key case: patches the live ProseMirror `title_page` node when a
 * view is mounted and already has one, otherwise falls back to editing the raw text
 * (also used when no title_page node exists yet — the editor's text-sync effect will
 * rebuild the doc, including a fresh title_page node, from the new text).
 */
export function setFlatFrontmatterField(
  view: EditorView | null,
  text: string,
  setText: (next: string) => void,
  key: string,
  value: string,
): void {
  if (view) {
    let titlePagePos: number | null = null
    view.state.doc.forEach((node, offset) => {
      if (node.type.name === 'title_page') titlePagePos = offset
    })

    if (titlePagePos !== null) {
      let tr = view.state.tr
      const tpNode = view.state.doc.nodeAt(titlePagePos)!
      let existingPos: number | null = null
      let pos = titlePagePos + 1
      tpNode.forEach(field => {
        if (field.attrs['fmKey'] === key) existingPos = pos
        pos += field.nodeSize
      })

      if (existingPos !== null) {
        const fieldNode = view.state.doc.nodeAt(existingPos)!
        if (value === '') {
          tr = tr.delete(existingPos, existingPos + fieldNode.nodeSize)
        } else {
          tr = tr.replaceWith(existingPos + 1, existingPos + fieldNode.nodeSize - 1, schema.text(value))
        }
      } else if (value !== '') {
        const insertPos = titlePagePos + tpNode.nodeSize - 1
        const newField = schema.nodes['frontmatter_field']!.create({ fmKey: key }, schema.text(value))
        tr = tr.insert(insertPos, newField)
      }
      view.dispatch(tr)
      return
    }
  }
  setText(setFlatFrontmatterFieldInText(text, key, value))
}

/** Raw-text fallback for when no ProseMirror view is mounted (or it has no title_page
 *  node yet). Creates a frontmatter block from scratch if the document doesn't have one. */
export function setFlatFrontmatterFieldInText(text: string, key: string, value: string): string {
  const lines = text.split('\n')
  const fmStartIndex = lines.indexOf('---')
  if (fmStartIndex === -1) {
    if (value === '') return text
    return `---\n${key}: ${value}\n---\n\n${text}`
  }
  const fmEndIndex = lines.indexOf('---', fmStartIndex + 1)
  if (fmEndIndex === -1) return text

  const fmLines = lines.slice(fmStartIndex + 1, fmEndIndex)
  let keyLineIdx = -1
  for (let i = 0; i < fmLines.length; i++) {
    const match = /^([A-Za-z0-9_-]+):/.exec(fmLines[i]!)
    if (match && match[1] === key) { keyLineIdx = i; break }
  }

  if (keyLineIdx === -1) {
    if (value !== '') fmLines.push(`${key}: ${value}`)
  } else if (value === '') {
    fmLines.splice(keyLineIdx, 1)
  } else {
    fmLines[keyLineIdx] = `${key}: ${value}`
  }

  return [...lines.slice(0, fmStartIndex + 1), ...fmLines, ...lines.slice(fmEndIndex)].join('\n')
}

/**
 * Replace the whole title page with the frontmatter of `nextText` (the full Sutra text
 * after a title-page form save). When the formatted editor is mounted, this is one
 * ProseMirror transaction that swaps the `title_page` node, so it is a single undo step and
 * the caret and scroll position are kept; the editor's normal sync then updates the text.
 * Otherwise (source mode, no view) the text is set directly.
 */
export function applyTitlePageText(
  view: EditorView | null,
  nextText: string,
  setText: (next: string) => void,
): void {
  if (!view) { setText(nextText); return }
  const nextDoc = sutraToProsemirror(parse(nextText))
  const first = nextDoc.firstChild
  const nextTp = first && first.type.name === 'title_page' ? first : null

  let tpPos: number | null = null
  let tpSize = 0
  view.state.doc.forEach((node, offset) => {
    if (tpPos === null && node.type.name === 'title_page') { tpPos = offset; tpSize = node.nodeSize }
  })

  let tr = view.state.tr
  if (tpPos !== null && nextTp) tr = tr.replaceWith(tpPos, tpPos + tpSize, nextTp)
  else if (tpPos !== null) tr = tr.delete(tpPos, tpPos + tpSize)
  else if (nextTp) tr = tr.insert(0, nextTp)
  else return
  view.dispatch(tr)
}
