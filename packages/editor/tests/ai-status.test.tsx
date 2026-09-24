import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { formatActivity } from '../src/extensions/ai-provider'
import { AppShell } from '../src/shell/AppShell'
import { DocumentProvider } from '../src/context/DocumentContext'
import { LanguageProvider } from '../src/i18n/LanguageContext'
import { TranslationProvider } from '../src/i18n/useTranslation'
import { stubAIProvider } from './helpers/stub-providers'

describe('AI Status Bar indicator', () => {
  it('formats in-flight calls', () => {
    expect(formatActivity([])).toBe('')
    expect(formatActivity([{ label: 'Gemini (gemma-31b)' }])).toBe('Calling Gemini (gemma-31b)...')
    expect(formatActivity([{ label: 'Gemini (gemma-31b)' }, { label: 'Gemini (gemma-31b)' }]))
      .toBe('Calling Gemini (gemma-31b) (2 calls)...')
    expect(formatActivity([{ label: 'Gemini (gemma-31b)' }, { label: 'Groq (llama3)' }]))
      .toBe('Calling Gemini (gemma-31b), Groq (llama3)...')
  })

  it("renders the provider's activity inside AppShell", () => {
    const ai = stubAIProvider()
    render(
      <TranslationProvider>
        <DocumentProvider aiProvider={ai}>
          <LanguageProvider>
            <AppShell />
          </LanguageProvider>
        </DocumentProvider>
      </TranslationProvider>
    )

    expect(screen.queryByText(/Calling/)).toBeNull()
    act(() => { ai.setActivity([{ label: 'Google AI Studio (gemma-31b)' }]) })
    expect(screen.getByText('Calling Google AI Studio (gemma-31b)...')).toBeInTheDocument()
    act(() => { ai.setActivity([]) })
    expect(screen.queryByText(/Calling/)).toBeNull()
  })
})
