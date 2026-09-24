import { Fragment, Slice } from 'prosemirror-model'
import { parse } from '@sutrata/parser'
import { sutraToProsemirror } from './sutra-to-prosemirror'
import { getEditorView, getSourceView } from './editor-bus'

export function insertSutra(sutraText: string, mode: 'formatted' | 'source') {
  if (mode === 'formatted') {
    const view = getEditorView()
    if (!view) return
    
    const ast = parse(sutraText)
    const pmDoc = sutraToProsemirror(ast)
    
    // Extract nodes from the parsed doc, skipping title_page
    const nodes: any[] = []
    pmDoc.content.forEach(node => {
      if (node.type.name !== 'title_page') {
        nodes.push(node)
      }
    })
    
    if (nodes.length > 0) {
      const fragment = Fragment.from(nodes)
      const slice = new Slice(fragment, 0, 0)
      const tr = view.state.tr.replaceSelection(slice)
      view.dispatch(tr)
      view.focus()
    }
  } else {
    const cm = getSourceView()
    if (!cm) return
    const transaction = cm.state.update({
      changes: {
        from: cm.state.selection.main.from,
        to: cm.state.selection.main.to,
        insert: sutraText,
      },
      selection: { anchor: cm.state.selection.main.from + sutraText.length }
    })
    cm.dispatch(transaction)
    cm.focus()
  }
}
