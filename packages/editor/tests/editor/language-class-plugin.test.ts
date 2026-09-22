import { describe, it, expect } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { schema } from '../../src/editor/schema'
import { createLanguageClassPlugin } from '../../src/editor/language-class-plugin'

describe('language-class-plugin', () => {
  function createStateWithPlugin(docContent: any) {
    const plugin = createLanguageClassPlugin()
    const state = EditorState.create({
      doc: schema.node('doc', null, [schema.nodeFromJSON(docContent)]),
      plugins: [plugin],
    })
    return { state, plugin }
  }

  function collectDecorations(decorationSet: any): any[] {
    // DecorationSet.find() returns an array of Decoration objects
    return decorationSet.find()
  }

  it('applies .cs-lang-en to English text block', () => {
    const { state, plugin } = createStateWithPlugin({
      type: 'action',
      content: [{ type: 'text', text: 'Hello world' }],
    })

    const decorationSet = plugin.getState(state)
    expect(decorationSet).toBeDefined()

    const decorations = collectDecorations(decorationSet)
    expect(decorations.length).toBeGreaterThan(0)

    const hasEnglishClass = decorations.some((d: any) =>
      d.spec?.class?.includes('cs-lang-en')
    )
    expect(hasEnglishClass).toBe(true)
  })

  it('applies .cs-lang-ta to Tamil text block', () => {
    const { state, plugin } = createStateWithPlugin({
      type: 'dialogue',
      content: [{ type: 'text', text: 'இது ஒரு தமிழ் வாக்கியம்' }],
    })

    const decorationSet = plugin.getState(state)
    const decorations = collectDecorations(decorationSet)
    expect(decorations.length).toBeGreaterThan(0)

    // Check that a decoration with Tamil class exists
    const hasTamilClass = decorations.some((d: any) =>
      d.spec?.class?.includes('cs-lang-ta')
    )
    expect(hasTamilClass).toBe(true)
  })

  it('applies .cs-lang-hi to Hindi/Devanagari text block', () => {
    const { state, plugin } = createStateWithPlugin({
      type: 'character',
      content: [{ type: 'text', text: 'यह एक हिंदी वाक्य है' }],
    })

    const decorationSet = plugin.getState(state)
    const decorations = collectDecorations(decorationSet)

    const hasHindiClass = decorations.some((d: any) =>
      d.spec?.class?.includes('cs-lang-hi')
    )
    expect(hasHindiClass).toBe(true)
  })

  it('respects inline {lang=…} tag override', () => {
    const { state, plugin } = createStateWithPlugin({
      type: 'parenthetical',
      content: [{ type: 'text', text: 'English text {lang=ml}' }],
    })

    const decorationSet = plugin.getState(state)
    const decorations = collectDecorations(decorationSet)

    const hasMalayalamClass = decorations.some((d: any) =>
      d.spec?.class?.includes('cs-lang-ml')
    )
    expect(hasMalayalamClass).toBe(true)
  })

  it('updates classes on doc change', () => {
    const { state: initialState, plugin } = createStateWithPlugin({
      type: 'action',
      content: [{ type: 'text', text: 'Hello world' }],
    })

    let state = initialState
    let decorationSet = plugin.getState(state)
    let decorations = collectDecorations(decorationSet)

    const englishCount = decorations.filter((d: any) =>
      d.spec?.class?.includes('cs-lang-en')
    ).length
    expect(englishCount).toBeGreaterThan(0)

    // Update the doc - select all text in the block and replace with Tamil
    // The block content starts at position 1 (after the opening tag)
    // Find the end of the text node
    const selection = state.selection
    const from = 1  // start of content in the block
    const to = state.doc.content.content[0].nodeSize - 1  // end of action node minus closing

    const tr = state.tr.deleteRange(from, to).insertText('இது ஒரு தமிழ் வாக்கியம்', from)
    const newState = state.apply(tr)
    decorationSet = plugin.getState(newState)
    decorations = collectDecorations(decorationSet)

    // Should now have Tamil decoration
    const hasTamilClass = decorations.some((d: any) =>
      d.spec?.class?.includes('cs-lang-ta')
    )
    expect(hasTamilClass).toBe(true)
  })

  it('defaults to .cs-lang-en for empty blocks', () => {
    const { state, plugin } = createStateWithPlugin({
      type: 'dialogue',
      content: [],
    })

    const decorationSet = plugin.getState(state)
    const decorations = collectDecorations(decorationSet)

    const hasEnglishClass = decorations.some((d: any) =>
      d.spec?.class?.includes('cs-lang-en')
    )
    expect(hasEnglishClass).toBe(true)
  })

  it('handles multiple blocks with different languages', () => {
    const plugin = createLanguageClassPlugin()
    const state = EditorState.create({
      doc: schema.node('doc', null, [
        schema.node('action', null, [schema.text('Hello world')]),
        schema.node('dialogue', null, [schema.text('இது ஒரு தமிழ் வாக்கியம்')]),
        schema.node('character', null, [schema.text('यह एक हिंदी वाक्य है')]),
      ]),
      plugins: [plugin],
    })

    const decorationSet = plugin.getState(state)
    const decorations = collectDecorations(decorationSet)

    const englishCount = decorations.filter((d: any) =>
      d.spec?.class?.includes('cs-lang-en')
    ).length
    const tamilCount = decorations.filter((d: any) =>
      d.spec?.class?.includes('cs-lang-ta')
    ).length
    const hindiCount = decorations.filter((d: any) =>
      d.spec?.class?.includes('cs-lang-hi')
    ).length

    expect(englishCount).toBe(1)
    expect(tamilCount).toBe(1)
    expect(hindiCount).toBe(1)
  })

  it('class persists across selection changes', () => {
    const { state: initialState, plugin } = createStateWithPlugin({
      type: 'dialogue',
      content: [{ type: 'text', text: 'இது ஒரு தமிழ் வாக்கியம்' }],
    })

    const decorationSet1 = plugin.getState(initialState)
    const decorations1 = collectDecorations(decorationSet1)

    // Change selection without changing doc
    const tr = initialState.tr.setSelection(initialState.selection)
    const newState = initialState.apply(tr)
    const decorationSet2 = plugin.getState(newState)
    const decorations2 = collectDecorations(decorationSet2)

    // Decorations should remain the same
    const class1 = decorations1[0]?.spec?.class
    const class2 = decorations2[0]?.spec?.class

    expect(class1).toBe(class2)
    expect(class1).toContain('cs-lang-ta')
  })

  it('applies Telugu language class correctly', () => {
    const { state, plugin } = createStateWithPlugin({
      type: 'parenthetical',
      content: [{ type: 'text', text: 'ఇది ఒక నమూనా లైన్' }],
    })

    const decorationSet = plugin.getState(state)
    const decorations = collectDecorations(decorationSet)

    const hasTeluguClass = decorations.some((d: any) =>
      d.spec?.class?.includes('cs-lang-te')
    )
    expect(hasTeluguClass).toBe(true)
  })

  it('applies Kannada language class correctly', () => {
    const { state, plugin } = createStateWithPlugin({
      type: 'centered',
      content: [{ type: 'text', text: 'ಇದು ಒಂದು ಮಾದರಿ ಲೈನ್' }],
    })

    const decorationSet = plugin.getState(state)
    const decorations = collectDecorations(decorationSet)

    const hasKannadaClass = decorations.some((d: any) =>
      d.spec?.class?.includes('cs-lang-kn')
    )
    expect(hasKannadaClass).toBe(true)
  })

  it('applies Malayalam language class correctly', () => {
    const { state, plugin } = createStateWithPlugin({
      type: 'lyrics',
      content: [{ type: 'text', text: 'ഇത് ഒരു സാമ്പിൾ ലൈൻ ആണ്' }],
    })

    const decorationSet = plugin.getState(state)
    const decorations = collectDecorations(decorationSet)

    const hasMalayalamClass = decorations.some((d: any) =>
      d.spec?.class?.includes('cs-lang-ml')
    )
    expect(hasMalayalamClass).toBe(true)
  })

  it('does not apply classes to non-block nodes', () => {
    const plugin = createLanguageClassPlugin()
    const state = EditorState.create({
      doc: schema.node('doc', null, [
        schema.node('action', null, [schema.text('Some text')]),
      ]),
      plugins: [plugin],
    })

    const decorationSet = plugin.getState(state)
    const decorations = collectDecorations(decorationSet)

    // Should have exactly 1 decoration (for the action block, not for inline text nodes)
    expect(decorations.length).toBe(1)
  })

  it('skips decorating the doc node itself', () => {
    const { state, plugin } = createStateWithPlugin({
      type: 'action',
      content: [{ type: 'text', text: 'Hello' }],
    })

    const decorationSet = plugin.getState(state)
    const decorations = collectDecorations(decorationSet)

    // Should not have a decoration for the doc node (offset 0)
    const hasDocDecoration = decorations.some((d: any) =>
      d.from === 0 && d.to === state.doc.nodeSize
    )
    // The decoration should be for the action block, not the entire doc
    expect(decorations.length).toBeGreaterThan(0)
    expect(hasDocDecoration).toBe(false)
  })
})
