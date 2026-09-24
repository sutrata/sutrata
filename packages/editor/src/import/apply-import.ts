import { parse } from '@sutrata/parser'
import type { Node as PmNode } from 'prosemirror-model'
import { getEditorView, getSourceView } from '../editor/editor-bus'
import { sutraToProsemirror } from '../editor/sutra-to-prosemirror'

/**
 * Put imported Sutra into the document as ONE edit (a single undo step):
 * `replace` swaps the body and keeps the title page; `append` adds after the
 * last block. Goes through whichever editor is mounted; without one, sets
 * the text directly.
 */
export function applyImport(body: string, how: 'replace' | 'append', text: string, setText: (t: string) => void): void {
  const view = getEditorView()
  if (view) {
    const nodes: PmNode[] = []
    sutraToProsemirror(parse(body + '\n')).forEach(n => { if (n.type.name !== 'title_page') nodes.push(n) })
    const doc = view.state.doc
    const first = doc.firstChild
    const bodyStart = first && first.type.name === 'title_page' ? first.nodeSize : 0
    const tr = how === 'replace'
      ? view.state.tr.replaceWith(bodyStart, doc.content.size, nodes)
      : view.state.tr.insert(doc.content.size, nodes)
    view.dispatch(tr.scrollIntoView())
    return
  }

  const frontmatter = parse(text).frontmatter?.raw ?? ''
  const next = how === 'replace'
    ? `${frontmatter}${frontmatter ? '\n' : ''}${body.trim()}\n`
    : `${text.trimEnd()}\n\n${body.trim()}\n`
  const source = getSourceView()
  if (source) {
    source.dispatch({ changes: { from: 0, to: source.state.doc.length, insert: next } })
    return
  }
  setText(next)
}
