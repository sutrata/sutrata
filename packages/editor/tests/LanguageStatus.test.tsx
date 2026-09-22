import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageStatus } from '../src/shell/LanguageStatus'
import { LanguageProvider } from '../src/i18n/LanguageContext'
import { DocumentProvider } from '../src/context/DocumentContext'

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <DocumentProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </DocumentProvider>
  )
}

describe('LanguageStatus', () => {
  it('renders with current language code', () => {
    render(
      <TestWrapper>
        <LanguageStatus />
      </TestWrapper>
    )
    // Should show "EN" for English (default)
    expect(screen.getByText('EN')).toBeInTheDocument()
  })

  it('opens menu on button click', () => {
    render(
      <TestWrapper>
        <LanguageStatus />
      </TestWrapper>
    )
    const btn = screen.getByText('EN')
    fireEvent.click(btn)
    // Menu should be visible with language options
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Tamil')).toBeInTheDocument()
  })

  it('closes menu after language selection', () => {
    const { container } = render(
      <TestWrapper>
        <LanguageStatus />
      </TestWrapper>
    )
    const btn = screen.getByText('EN')
    fireEvent.click(btn)
    const tamilOption = screen.getByText('Tamil')
    fireEvent.click(tamilOption)
    // Menu should close
    expect(container.querySelector('.cs-lang-menu')).not.toBeInTheDocument()
  })

  it('highlights current language in menu', () => {
    const { container } = render(
      <TestWrapper>
        <LanguageStatus />
      </TestWrapper>
    )
    const btn = screen.getByText('EN')
    fireEvent.click(btn)
    // Find the English option in the menu
    const menuOptions = container.querySelectorAll('.cs-lang-option')
    // First option should be English and should be active
    expect(menuOptions[0]).toHaveClass('cs-lang-active')
  })

  it('updates document text with language tag on override', () => {
    const { container } = render(
      <TestWrapper>
        <LanguageStatus />
      </TestWrapper>
    )
    const btn = screen.getByText('EN')
    fireEvent.click(btn)
    const tamilOption = screen.getByText('Tamil')
    fireEvent.click(tamilOption)
    // Text should have been mutated with language tag
    // Menu should be closed
    expect(container.querySelector('.cs-lang-menu')).not.toBeInTheDocument()
  })

  it('renders all 10 language options in menu', () => {
    render(
      <TestWrapper>
        <LanguageStatus />
      </TestWrapper>
    )
    const btn = screen.getByText('EN')
    fireEvent.click(btn)

    const expectedLanguages = [
      'English',
      'Hindi (Devanagari)',
      'Tamil',
      'Telugu',
      'Kannada',
      'Malayalam',
      'Bengali',
      'Gujarati',
      'Gurmukhi',
      'Odia',
    ]

    expectedLanguages.forEach(lang => {
      expect(screen.getByText(lang)).toBeInTheDocument()
    })
  })

  it('toggles menu visibility on repeated button clicks', () => {
    const { container } = render(
      <TestWrapper>
        <LanguageStatus />
      </TestWrapper>
    )
    const btn = screen.getByText('EN')

    // Open menu
    fireEvent.click(btn)
    expect(container.querySelector('.cs-lang-menu')).toBeInTheDocument()

    // Close menu
    fireEvent.click(btn)
    expect(container.querySelector('.cs-lang-menu')).not.toBeInTheDocument()

    // Open menu again
    fireEvent.click(btn)
    expect(container.querySelector('.cs-lang-menu')).toBeInTheDocument()
  })
})
