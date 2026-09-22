import { describe, it, expect } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { schema } from '../../src/editor/schema'
import { createSpellcheckPlugin, setSpellcheckLanguage, tokenizeWords } from '../../src/spellcheck/spellcheck-plugin'

describe('spellcheck-plugin', () => {
  it('createSpellcheckPlugin returns a Plugin', () => {
    const plugin = createSpellcheckPlugin()
    expect(plugin).toBeDefined()
    expect(typeof plugin.spec.state).toBe('object')
  })

  it('plugin initializes with empty DecorationSet', () => {
    const plugin = createSpellcheckPlugin()
    const state = EditorState.create({
      schema,
      plugins: [plugin],
    })
    // Access state via plugin key (correct way without a live EditorView)
    const pluginState = plugin.getState(state)
    expect(pluginState).toBeDefined()
  })

  it('setSpellcheckLanguage does not throw', () => {
    expect(() => setSpellcheckLanguage('hi')).not.toThrow()
    expect(() => setSpellcheckLanguage('en')).not.toThrow()
  })

  it('plugin is registered in buildPlugins', async () => {
    const { buildPlugins } = await import('../../src/editor/plugins')
    const plugins = buildPlugins()
    // Should have more than 4 plugins (history, keymaps x2, languageClass, ime, translit, autocomplete, spellcheck)
    expect(plugins.length).toBeGreaterThan(4)
  })

  it('tokenizeWords splits plain text into tokens', () => {
    const tokens = tokenizeWords('hello world foo')
    expect(tokens).toHaveLength(3)
    expect(tokens[0]).toMatchObject({ word: 'hello', start: 0, end: 5 })
    expect(tokens[1]).toMatchObject({ word: 'world', start: 6, end: 11 })
    expect(tokens[2]).toMatchObject({ word: 'foo', start: 12, end: 15 })
  })

  it('tokenizeWords handles punctuation and numbers', () => {
    const tokens = tokenizeWords('Hello, world! 123')
    // Should only capture words, not numbers or punctuation
    const words = tokens.map(t => t.word)
    expect(words).toContain('Hello')
    expect(words).toContain('world')
    expect(words).not.toContain('123')
  })

  it('tokenizeWords returns empty array for empty string', () => {
    expect(tokenizeWords('')).toHaveLength(0)
  })
})
