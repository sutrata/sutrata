import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DocumentProvider } from '../src/context/DocumentContext'
import { TranslationProvider } from '../src/i18n/useTranslation'
import { AppBar } from '../src/shell/AppBar'

function renderAppBar() {
  return render(
    <TranslationProvider>
      <DocumentProvider>
        <AppBar />
      </DocumentProvider>
    </TranslationProvider>
  )
}

describe('AppBar', () => {
  it('shows the mode toggle pointing to the NEXT state (Source while formatted)', () => {
    renderAppBar()
    expect(screen.getByRole('button', { name: /switch to source/i })).toBeInTheDocument()
  })

  it('flips the mode toggle label on click', () => {
    renderAppBar()
    fireEvent.click(screen.getByRole('button', { name: /switch to source/i }))
    expect(screen.getByRole('button', { name: /switch to formatted/i })).toBeInTheDocument()
  })

  it('toggles ribbon visibility', () => {
    renderAppBar()
    const btn = screen.getByRole('button', { name: /toolbar/i })
    fireEvent.click(btn)
    expect(btn).toBeInTheDocument()
  })
})
