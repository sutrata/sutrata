import { describe, it, expect } from 'vitest'
import { createAutocompletePlugin } from '../../src/autocomplete/AutocompletePlugin'

describe('AutocompletePlugin', () => {
  it('createAutocompletePlugin returns a ProseMirror Plugin', () => {
    const plugin = createAutocompletePlugin()
    expect(plugin).toBeDefined()
    expect(typeof plugin.spec).toBe('object')
  })

  it('plugin has handleKeyDown prop', () => {
    const plugin = createAutocompletePlugin()
    expect(typeof plugin.spec.props?.handleKeyDown).toBe('function')
  })

  it('plugin has view prop', () => {
    const plugin = createAutocompletePlugin()
    expect(typeof plugin.spec.view).toBe('function')
  })
})
