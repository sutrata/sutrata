import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { formatActiveCalls, subscribeToAICalls, mockActiveCallsList } from '../src/ai/ai-client'
import { AppShell } from '../src/shell/AppShell'
import { DocumentProvider } from '../src/context/DocumentContext'
import { LanguageProvider } from '../src/i18n/LanguageContext'
import { TranslationProvider } from '../src/i18n/useTranslation'

describe('AI Status Bar indicator', () => {
  it('formats active calls correctly', () => {
    expect(formatActiveCalls([])).toBe('')
    expect(formatActiveCalls([{ providerName: 'Gemini', model: 'gemma-31b' }])).toBe('Calling Gemini (gemma-31b)...')
    expect(formatActiveCalls([
      { providerName: 'Gemini', model: 'gemma-31b' },
      { providerName: 'Gemini', model: 'gemma-31b' },
    ])).toBe('Calling Gemini (gemma-31b) (2 calls)...')
    expect(formatActiveCalls([
      { providerName: 'Gemini', model: 'gemma-31b' },
      { providerName: 'Groq', model: 'llama3' },
    ])).toBe('Calling Gemini (gemma-31b), Groq (llama3)...')
  })

  it('subscribes and notifies when calls change', () => {
    const cb = vi.fn()
    const unsubscribe = subscribeToAICalls(cb)
    expect(cb).toHaveBeenCalledWith([])

    act(() => {
      mockActiveCallsList([{ providerName: 'Groq', model: 'llama3' }])
    })
    expect(cb).toHaveBeenLastCalledWith([{ providerName: 'Groq', model: 'llama3' }])

    act(() => {
      mockActiveCallsList([])
    })
    expect(cb).toHaveBeenLastCalledWith([])

    unsubscribe()
  })

  it('renders status indicator inside AppShell', () => {
    render(
      <TranslationProvider>
        <DocumentProvider>
          <LanguageProvider>
            <AppShell />
          </LanguageProvider>
        </DocumentProvider>
      </TranslationProvider>
    )

    // Initially, no indicator is rendered (since calls list is empty)
    expect(screen.queryByText(/Calling/)).toBeNull()

    // Mock active calls
    act(() => {
      mockActiveCallsList([{ providerName: 'Google AI Studio', model: 'gemma-31b' }])
    })

    // Now it should be displayed
    expect(screen.getByText('Calling Google AI Studio (gemma-31b)...')).toBeInTheDocument()

    // Clear calls
    act(() => {
      mockActiveCallsList([])
    })

    // Indicator should be gone
    expect(screen.queryByText(/Calling/)).toBeNull()
  })
})
