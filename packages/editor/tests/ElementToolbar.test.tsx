import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ElementToolbar } from '../src/shell/ElementToolbar'
import { TranslationProvider } from '../src/i18n/useTranslation'
import { DocumentProvider } from '../src/context/DocumentContext'

describe('ElementToolbar', () => {
  it('renders element buttons and B/I/U at the end', () => {
    render(
      <TranslationProvider>
        <DocumentProvider>
          <ElementToolbar />
        </DocumentProvider>
      </TranslationProvider>
    )
    expect(screen.getByRole('button', { name: /scene heading/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /character/i })).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    const labels = buttons.map(b => b.getAttribute('aria-label'))
    expect(labels.indexOf('Bold')).toBeGreaterThan(labels.indexOf('Scene Heading'))
    expect(labels).toContain('Underline')
  })

  it('renders a button for every screenplay element, including Lyrics', () => {
    render(
      <TranslationProvider>
        <DocumentProvider>
          <ElementToolbar />
        </DocumentProvider>
      </TranslationProvider>
    )
    const labels = screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))
    for (const name of [
      'Scene Heading', 'Action', 'Character', 'Dialogue', 'Parenthetical',
      'Transition', 'Centered', 'Lyrics', 'Note', 'Page Break', 'Section',
    ]) {
      expect(labels).toContain(name)
    }
  })
})
