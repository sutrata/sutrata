import { describe, it, expect, vi, afterEach } from 'vitest'
import { showSpellMenu } from '../../src/spellcheck/spell-menu'

const items = () => [...document.querySelectorAll('.cs-spell-menu-item')].map(e => e.textContent)
const press = (text: string) =>
  [...document.querySelectorAll('.cs-spell-menu-item')].find(e => e.textContent === text)!
    .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

describe('spell menu', () => {
  afterEach(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); document.body.innerHTML = '' })

  it('lists suggestions then Ignore, and acts on a pick', () => {
    const onReplace = vi.fn(); const onIgnore = vi.fn()
    showSpellMenu({ x: 5, y: 5, word: 'helo', suggestions: ['hello', 'help'], canEdit: true, onReplace, onIgnore })
    expect(items()).toEqual(['hello', 'help', 'Ignore “helo”'])
    press('help')
    expect(onReplace).toHaveBeenCalledWith('help')
    expect(document.querySelector('.cs-spell-menu')).toBeNull()
    showSpellMenu({ x: 5, y: 5, word: 'helo', suggestions: [], canEdit: true, onReplace, onIgnore })
    expect(items()).toEqual(['No suggestions', 'Ignore “helo”'])
    press('Ignore “helo”')
    expect(onIgnore).toHaveBeenCalled()
  })

  it('offers only Ignore when the script is read-only', () => {
    showSpellMenu({ x: 5, y: 5, word: 'helo', suggestions: ['hello'], canEdit: false, onReplace: vi.fn(), onIgnore: vi.fn() })
    expect(items()).toEqual(['Ignore “helo”'])
  })
})
