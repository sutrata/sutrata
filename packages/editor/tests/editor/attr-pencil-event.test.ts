import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { schema } from '../../src/editor/schema'
import { createAttrPencilPlugin } from '../../src/editor/attr-pencil-plugin'
import { EDIT_SCENE_ATTRS_EVENT } from '../../src/editor/editor-bus'

function mount() {
  const doc = schema.node('doc', null, [
    schema.node('scene_heading', null, [schema.text('INT. ROOM - DAY')]),
    schema.node('action', null, [schema.text('She waits.')]),
  ])
  const view = new EditorView(document.createElement('div'), { state: EditorState.create({ doc, plugins: [createAttrPencilPlugin()] }) })
  document.body.appendChild(view.dom)
  return view
}
const click = () => document.querySelector('.cs-attr-pencil:not(.cs-tp-pencil)')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

describe('scene heading pencil', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('opens the attribute menu when no panel takes the request', () => {
    mount(); click()
    expect(document.querySelector('.cs-attr-menu')).not.toBeNull()
  })

  it('hands over to a panel that takes the request, with the caret in the scene', () => {
    const view = mount()
    let asked = 0
    window.addEventListener(EDIT_SCENE_ATTRS_EVENT, e => { asked++; e.preventDefault() }, { once: true })
    view.dispatch(view.state.tr.setSelection(view.state.selection)) // caret starts elsewhere
    click()
    expect(asked).toBe(1)
    expect(document.querySelector('.cs-attr-menu')).toBeNull()
    expect(view.state.selection.$from.parent.type.name).toBe('scene_heading')
  })
})
