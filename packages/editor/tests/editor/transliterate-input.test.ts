import { describe, it, expect, beforeEach } from 'vitest'
import { setTranslitMode, isTranslitMode, createTranslitPlugin } from '../../src/editor/transliterate-input'

describe('transliterate-input', () => {
  beforeEach(() => {
    setTranslitMode(false)
  })

  it('isTranslitMode returns false by default', () => {
    expect(isTranslitMode()).toBe(false)
  })

  it('setTranslitMode(true) enables mode', () => {
    setTranslitMode(true, 'hi')
    expect(isTranslitMode()).toBe(true)
  })

  it('setTranslitMode(false) disables mode', () => {
    setTranslitMode(true, 'hi')
    setTranslitMode(false)
    expect(isTranslitMode()).toBe(false)
  })

  it('createTranslitPlugin returns a ProseMirror Plugin', () => {
    const plugin = createTranslitPlugin()
    expect(plugin).toBeDefined()
    expect(typeof plugin.spec).toBe('object')
    expect(typeof plugin.spec.props?.handleTextInput).toBe('function')
  })

  it('plugin handleTextInput returns false when mode is off', () => {
    const plugin = createTranslitPlugin()
    const mockView = {
      state: { selection: { from: 5 }, tr: { replaceWith: () => ({}) }, schema: { text: (t: string) => t } },
      dispatch: () => {},
    } as any
    const result = plugin.spec.props!.handleTextInput!(mockView, 5, 5, 'a')
    expect(result).toBe(false)
  })

  it('plugin handleTextInput returns false for roman chars in translit mode (buffering)', () => {
    setTranslitMode(true, 'hi')
    const plugin = createTranslitPlugin()
    const mockView = {
      state: { selection: { from: 5 }, tr: { replaceWith: () => ({}) }, schema: { text: (t: string) => t } },
      dispatch: () => {},
    } as any
    // Roman char should be buffered, returns false to let PM insert it
    const result = plugin.spec.props!.handleTextInput!(mockView, 5, 5, 'n')
    expect(result).toBe(false)
  })
})
