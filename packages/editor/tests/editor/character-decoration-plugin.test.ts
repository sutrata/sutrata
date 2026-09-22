import { describe, it, expect } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { schema } from '../../src/editor/schema'
import { createCharacterDecorationPlugin, findCharacterDecorationRanges } from '../../src/editor/character-decoration-plugin'

describe('findCharacterDecorationRanges', () => {
  it('finds a single trailing extension', () => {
    const r = findCharacterDecorationRanges('ARAVIND (V.O.)')
    expect(r).toEqual({ parenStart: 8, parenEnd: 14 })
  })

  it('finds multiple trailing paren groups as one range', () => {
    const r = findCharacterDecorationRanges("ARAVIND (V.O.) (CONT'D)")
    expect(r).toEqual({ parenStart: 8, parenEnd: 23 })
  })

  it('finds a trailing dual-dialogue marker alone', () => {
    const r = findCharacterDecorationRanges('ARAVIND ^')
    expect(r).toEqual({ dualStart: 8, dualEnd: 9 })
  })

  it('finds both an extension and a dual marker together', () => {
    const r = findCharacterDecorationRanges('ARAVIND (V.O.) ^')
    expect(r).toEqual({ parenStart: 8, parenEnd: 14, dualStart: 15, dualEnd: 16 })
  })

  it('finds nothing for a plain name', () => {
    expect(findCharacterDecorationRanges('ARAVIND')).toEqual({})
  })

  it('finds nothing for an unclosed paren (still typing)', () => {
    expect(findCharacterDecorationRanges('ARAVIND (')).toEqual({})
  })
})

describe('character-decoration-plugin', () => {
  function createStateWithPlugin(text: string) {
    const plugin = createCharacterDecorationPlugin()
    const state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('character', null, [schema.text(text)])]),
      plugins: [plugin],
    })
    return { state, plugin }
  }

  it('decorates the trailing extension with cs-character-extension', () => {
    const { state, plugin } = createStateWithPlugin('ARAVIND (V.O.)')
    const decorations = plugin.getState(state)!.find()
    const deco = decorations.find((d: any) => d.spec?.class === 'cs-character-extension')
    expect(deco).toBeDefined()
    // +1 for the block node's own opening position
    expect(deco.from).toBe(1 + 8)
    expect(deco.to).toBe(1 + 14)
  })

  it('decorates multiple trailing paren groups as one extension span', () => {
    const { state, plugin } = createStateWithPlugin("ARAVIND (V.O.) (CONT'D)")
    const decorations = plugin.getState(state)!.find()
    const deco = decorations.find((d: any) => d.spec?.class === 'cs-character-extension')
    expect(deco.from).toBe(1 + 8)
    expect(deco.to).toBe(1 + 23)
  })

  it('decorates a trailing dual-dialogue marker with cs-character-dual-marker', () => {
    const { state, plugin } = createStateWithPlugin('ARAVIND ^')
    const decorations = plugin.getState(state)!.find()
    const deco = decorations.find((d: any) => d.spec?.class === 'cs-character-dual-marker')
    expect(deco).toBeDefined()
  })

  it('decorates both an extension and a dual marker on the same cue', () => {
    const { state, plugin } = createStateWithPlugin('ARAVIND (V.O.) ^')
    const decorations = plugin.getState(state)!.find()
    expect(decorations.some((d: any) => d.spec?.class === 'cs-character-extension')).toBe(true)
    expect(decorations.some((d: any) => d.spec?.class === 'cs-character-dual-marker')).toBe(true)
  })

  it('produces no decorations for a plain character name', () => {
    const { state, plugin } = createStateWithPlugin('ARAVIND')
    expect(plugin.getState(state)!.find()).toHaveLength(0)
  })

  it('does not decorate non-character blocks', () => {
    const plugin = createCharacterDecorationPlugin()
    const state = EditorState.create({
      doc: schema.node('doc', null, [schema.node('action', null, [schema.text('Just an (aside) in action.')])]),
      plugins: [plugin],
    })
    expect(plugin.getState(state)!.find()).toHaveLength(0)
  })

  it('recomputes decorations after a doc-changing transaction', () => {
    const { state: initialState, plugin } = createStateWithPlugin('ARAVIND')
    expect(plugin.getState(initialState)!.find()).toHaveLength(0)

    const tr = initialState.tr.insertText(' (V.O.)', 8)
    const newState = initialState.apply(tr)
    const decorations = plugin.getState(newState)!.find()
    expect(decorations.some((d: any) => d.spec?.class === 'cs-character-extension')).toBe(true)
  })
})
