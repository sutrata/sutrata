import type { Node as PmNode } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView, NodeView, ViewMutationRecord } from 'prosemirror-view'

/**
 * NodeView for scene_heading. Renders the heading text (ProseMirror-managed)
 * plus an editable scene-number input on the right. Tab from inside the text
 * area or a click on the number triggers focus of the input.
 *
 * The id value is stored purely as a node attribute — the PM content model
 * only contains the heading text.
 */
export class SceneHeadingView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private input: HTMLInputElement
  private pmView: EditorView
  private getPos: () => number | undefined

  constructor(node: PmNode, view: EditorView, getPos: () => number | undefined) {
    this.pmView = view
    this.getPos = getPos

    // Outer wrapper — flex row, same as CSS sets for .cs-scene-heading
    this.dom = document.createElement('div')
    this.dom.className = 'cs-scene-heading'
    if (node.attrs['id']) {
      this.dom.dataset['sceneId'] = node.attrs['id'] as string
    }

    // Left: ProseMirror manages text content here
    this.contentDOM = document.createElement('span')
    this.contentDOM.className = 'cs-scene-heading-text'
    this.dom.appendChild(this.contentDOM)

    // Right: scene number input
    this.input = document.createElement('input')
    this.input.type = 'text'
    this.input.className = 'cs-scene-id-input'
    this.input.placeholder = '#'
    this.input.value = (node.attrs['id'] as string | null) ?? ''
    this.input.setAttribute('aria-label', 'Scene number')
    this.input.spellcheck = false
    this.input.readOnly = !view.editable

    this.input.addEventListener('keydown', this.onInputKeydown)
    this.input.addEventListener('blur', this.onInputBlur)
    // Prevent PM from handling clicks inside the input
    this.input.addEventListener('mousedown', (e) => e.stopPropagation())

    this.dom.appendChild(this.input)
  }

  /** Focus the id input — called by Tab keymap handler */
  focusInput() {
    this.input.focus()
    this.input.select()
  }

  private commit() {
    const raw = this.input.value.trim()
    const id = raw === '' ? null : raw
    const pos = this.getPos()
    if (pos === undefined) return
    const node = this.pmView.state.doc.nodeAt(pos)
    if (!node) return
    if (node.attrs['id'] === id) return
    const tr = this.pmView.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, id })
    this.pmView.dispatch(tr)
  }

  private onInputKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.input.value = (this.pmView.state.doc.nodeAt(this.getPos() ?? 0)?.attrs['id'] as string | null) ?? ''
      this.pmView.focus()
      return
    }
    if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault()
      e.stopPropagation()
      this.commit()
      const pos = this.getPos()
      if (pos !== undefined) {
        const node = this.pmView.state.doc.nodeAt(pos)
        if (node) {
          const endOfText = pos + node.nodeSize - 1
          const sel = TextSelection.near(this.pmView.state.doc.resolve(endOfText), -1)
          this.pmView.dispatch(this.pmView.state.tr.setSelection(sel))
        }
      }
      this.pmView.focus()
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      this.commit()
      // Move cursor to the start of the node after the scene heading
      const pos = this.getPos()
      if (pos !== undefined) {
        const node = this.pmView.state.doc.nodeAt(pos)
        if (node) {
          const afterPos = pos + node.nodeSize
          const { doc } = this.pmView.state
          if (afterPos <= doc.content.size) {
            const sel = TextSelection.near(doc.resolve(afterPos), 1)
            this.pmView.dispatch(this.pmView.state.tr.setSelection(sel))
          }
        }
      }
      this.pmView.focus()
      return
    }
  }

  private onInputBlur = () => {
    this.commit()
  }

  update(node: PmNode): boolean {
    if (node.type.name !== 'scene_heading') return false
    const id = (node.attrs['id'] as string | null) ?? ''
    // Keep DOM attr in sync
    if (id) this.dom.dataset['sceneId'] = id
    else delete this.dom.dataset['sceneId']
    this.input.readOnly = !this.pmView.editable
    // Only update input if it doesn't have focus (avoid clobbering in-progress edits)
    if (document.activeElement !== this.input) {
      this.input.value = id
    }
    return true
  }

  destroy() {
    this.input.removeEventListener('keydown', this.onInputKeydown)
    this.input.removeEventListener('blur', this.onInputBlur)
  }

  stopEvent(event: Event): boolean {
    // Let PM handle events inside contentDOM; swallow events on the input
    return event.target === this.input || (this.input.contains(event.target as Node))
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return this.input.contains(mutation.target as Node) || mutation.target === this.input
  }
}
