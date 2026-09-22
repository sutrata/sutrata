import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DocumentProvider } from '../src/context/DocumentContext'
import { LanguageProvider } from '../src/i18n/LanguageContext'
import { TranslationProvider } from '../src/i18n/useTranslation'
import { AppShell } from '../src/shell/AppShell'

describe('AppShell', () => {
  it('renders the AppBar and the ElementToolbar when ribbon is visible', () => {
    render(
      <TranslationProvider>
        <DocumentProvider>
          <LanguageProvider>
            <AppShell />
          </LanguageProvider>
        </DocumentProvider>
      </TranslationProvider>
    )
    expect(screen.getByRole('button', { name: /scene navigator/i })).toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: /editing toolbar/i })).toBeInTheDocument()
  })
})
