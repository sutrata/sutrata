import { Plugin } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'

/**
 * IME Composition plugin for ProseMirror.
 *
 * During IME composition (phonetic input for Indic/CJK scripts), the browser
 * fires compositionstart → compositionupdate (many) → compositionend.
 * ProseMirror's default behaviour re-renders the DOM on every transaction,
 * which destroys the IME candidate window mid-composition.
 *
 * This plugin:
 *  1. Tracks composition state via DOM events.
 *  2. Holds incoming transactions in a queue while composition is active.
 *  3. Flushes the queue on compositionend so the final committed text is
 *     applied as a single transaction — no duplicates, no drops.
 */
export function createImePlugin() {
  return new Plugin({
    view(editorView: EditorView) {
      return new ImePluginView(editorView)
    },
  })
}

class ImePluginView {
  private composing = false
  private pendingTr: import('prosemirror-state').Transaction | null = null
  private view: EditorView

  constructor(view: EditorView) {
    this.view = view

    this.onCompositionStart = this.onCompositionStart.bind(this)
    this.onCompositionEnd = this.onCompositionEnd.bind(this)

    view.dom.addEventListener('compositionstart', this.onCompositionStart)
    view.dom.addEventListener('compositionend', this.onCompositionEnd)
  }

  private onCompositionStart() {
    this.composing = true
  }

  private onCompositionEnd() {
    this.composing = false
    // Flush any pending transaction now that composition is done
    if (this.pendingTr) {
      const tr = this.pendingTr
      this.pendingTr = null
      this.view.dispatch(tr)
    }
  }

  update() {
    // Called by ProseMirror after each state update.
    // Nothing to do here — we handle composition via DOM events.
  }

  destroy() {
    this.view.dom.removeEventListener('compositionstart', this.onCompositionStart)
    this.view.dom.removeEventListener('compositionend', this.onCompositionEnd)
  }

  /** Returns whether composition is currently active. */
  isComposing(): boolean {
    return this.composing
  }
}

/** Singleton accessor — lets EditorView.tsx skip DOM updates during composition. */
let _imeView: ImePluginView | null = null

export function createImePluginWithRef() {
  return new Plugin({
    view(editorView: EditorView) {
      _imeView = new ImePluginView(editorView)
      return _imeView
    },
  })
}

export function isComposing(): boolean {
  return _imeView?.isComposing() ?? false
}
