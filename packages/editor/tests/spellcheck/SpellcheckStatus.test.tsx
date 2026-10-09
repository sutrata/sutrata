import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpellcheckStatus } from '../../src/spellcheck/SpellcheckStatus'
import { getSpellcheck, updateSpellcheck } from '../../src/spellcheck/settings'

describe('SpellcheckStatus (status bar)', () => {
  beforeEach(() => updateSpellcheck({ enabled: false, regional: '', ignored: [] }))

  it('shows the state and switches spell check on from its popover', () => {
    render(<SpellcheckStatus />)
    const button = screen.getByRole('button', { name: /spell check/i })
    expect(button.className).not.toContain('cs-sb-spell-on')
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(getSpellcheck().enabled).toBe(true)
    expect(screen.getByRole('button', { name: /spell check/i }).textContent).toBe('EN')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ta' } })
    expect(getSpellcheck().regional).toBe('ta')
    expect(screen.getByRole('button', { name: /spell check/i }).textContent).toContain('EN + ')
  })

  it('closes on Escape', () => {
    render(<SpellcheckStatus />)
    fireEvent.click(screen.getByRole('button', { name: /spell check/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
