import type { Node as PmNode } from 'prosemirror-model'
import type { EditorView, NodeView } from 'prosemirror-view'

export class FrontmatterFieldView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private counter: HTMLElement | null = null

  constructor(node: PmNode, view: EditorView, getPos: () => number | undefined) {
    this.dom = document.createElement('div')
    this.dom.className = 'cs-fm-field'
    this.dom.dataset['key'] = node.attrs['fmKey'] as string

    this.contentDOM = document.createElement('span')
    this.contentDOM.className = 'cs-fm-field-content'
    this.dom.appendChild(this.contentDOM)

    if (node.attrs['fmKey'] === 'logline') {
      this.counter = document.createElement('span')
      this.counter.className = 'cs-fm-logline-counter'
      this.updateCounter(node.textContent)
      this.dom.appendChild(this.counter)
    }
  }

  private updateCounter(text: string) {
    if (!this.counter) return
    const words = text.split(/\s+/).filter(Boolean).length
    this.counter.textContent = `${words} words`
    if (words > 50) {
      this.counter.style.color = '#c5221f' // red warning
      this.counter.style.background = '#fce8e6'
      this.counter.style.borderColor = '#fad2cf'
    } else if (words > 30) {
      this.counter.style.color = '#b06000' // orange warn/target
      this.counter.style.background = '#fef7e0'
      this.counter.style.borderColor = '#feebc8'
    } else {
      this.counter.style.color = '#8a887f' // clean gray
      this.counter.style.background = '#f0efe9'
      this.counter.style.borderColor = '#e2e0d8'
    }
  }

  update(node: PmNode): boolean {
    if (node.type.name !== 'frontmatter_field') return false
    if (node.attrs['fmKey'] === 'logline' && this.counter) {
      this.updateCounter(node.textContent)
    }
    return true
  }
}
