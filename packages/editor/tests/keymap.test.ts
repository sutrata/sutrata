import { describe, it, expect } from 'vitest'
import { keymapBindings } from '../src/editor/keymap'

describe('keymap bindings', () => {
  it('does not bind element-insertion shortcuts Mod-1..Mod-7', () => {
    for (let n = 1; n <= 7; n++) {
      expect(keymapBindings[`Mod-${n}`]).toBeUndefined()
    }
  })

  it('keeps editing shortcuts', () => {
    expect(keymapBindings['Mod-z']).toBeDefined()
    expect(keymapBindings['Mod-b']).toBeDefined()
    expect(keymapBindings['Mod-i']).toBeDefined()
    expect(keymapBindings['Mod-u']).toBeDefined()
    expect(keymapBindings['Enter']).toBeDefined()
  })
})
