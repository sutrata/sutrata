import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { schema } from '../../src/editor/schema'
import { createImePlugin, isComposing } from '../../src/editor/ime-plugin'

// Minimal EditorView mock — only needs dom + dispatch + state
function makeMockView(dom?: HTMLElement) {
  const el = dom ?? document.createElement('div')
  document.body.appendChild(el)
  return {
    dom: el,
    dispatch: vi.fn(),
    state: EditorState.create({ schema, plugins: [] }),
  }
}

describe('ime-plugin', () => {
  it('exports createImePlugin and isComposing', () => {
    expect(typeof createImePlugin).toBe('function')
    expect(typeof isComposing).toBe('function')
  })

  it('isComposing returns false when no composition active', () => {
    expect(isComposing()).toBe(false)
  })

  it('plugin view attaches compositionstart/end listeners to dom', () => {
    const dom = document.createElement('div')
    const addSpy = vi.spyOn(dom, 'addEventListener')
    const mockView = { ...makeMockView(dom), dom } as any
    const plugin = createImePlugin()
    plugin.spec.view!(mockView)

    expect(addSpy).toHaveBeenCalledWith('compositionstart', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('compositionend', expect.any(Function))
  })

  it('plugin view removes listeners on destroy', () => {
    const dom = document.createElement('div')
    const removeSpy = vi.spyOn(dom, 'removeEventListener')
    const mockView = { ...makeMockView(dom), dom } as any
    const plugin = createImePlugin()
    const view = plugin.spec.view!(mockView)

    view!.destroy!()

    expect(removeSpy).toHaveBeenCalledWith('compositionstart', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('compositionend', expect.any(Function))
  })

  it('compositionstart sets composing = true', () => {
    const dom = document.createElement('div')
    const mockView = { ...makeMockView(dom), dom } as any
    const plugin = createImePlugin()
    const pluginView = plugin.spec.view!(mockView) as any

    dom.dispatchEvent(new Event('compositionstart'))
    expect(pluginView.isComposing()).toBe(true)
  })

  it('compositionend sets composing = false', () => {
    const dom = document.createElement('div')
    const mockView = { ...makeMockView(dom), dom } as any
    const plugin = createImePlugin()
    const pluginView = plugin.spec.view!(mockView) as any

    dom.dispatchEvent(new Event('compositionstart'))
    expect(pluginView.isComposing()).toBe(true)
    dom.dispatchEvent(new Event('compositionend'))
    expect(pluginView.isComposing()).toBe(false)
  })
})
