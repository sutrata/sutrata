import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ProviderSettings } from '../src/ai/ProviderSettings'
import { getAIConfig, saveAIConfig, setApiKey } from '../src/ai/ai-client'

function mockModels(ids: string[]) {
  const original = global.fetch
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ data: ids.map(id => ({ id })) }), { status: 200 })) as any
  return () => { global.fetch = original }
}

describe('ProviderSettings', () => {
  beforeEach(() => localStorage.clear())
  // jsdom has no layout, so no scrollIntoView (the combobox keeps the active option visible).
  beforeAll(() => { Element.prototype.scrollIntoView = vi.fn() })

  it('lists live models once a key is entered and saves the chosen one per provider', async () => {
    const restore = mockModels(['llama-3.3-70b-versatile', 'qwen3-32b'])
    try {
      saveAIConfig({ activeProvider: 'groq', modelByProvider: {}, customProviders: [] })
      render(<ProviderSettings />)
      expect(await screen.findByText('Enter an API key to load models')).toBeInTheDocument()

      const keyInput = screen.getByLabelText(/API Key for Groq/)
      fireEvent.change(keyInput, { target: { value: 'gsk-test' } })
      fireEvent.blur(keyInput)

      const modelSelect = await screen.findByDisplayValue('Choose a model…')
      fireEvent.change(modelSelect, { target: { value: 'qwen3-32b' } })
      expect(getAIConfig().modelByProvider).toEqual({ groq: 'qwen3-32b' })
    } finally {
      restore()
    }
  })

  it('keeps a saved model the provider no longer lists, with a warning', async () => {
    const restore = mockModels(['llama-3.3-70b-versatile'])
    try {
      await setApiKey('groq', 'gsk-test')
      saveAIConfig({ activeProvider: 'groq', modelByProvider: { groq: 'retired-model' }, customProviders: [] })
      render(<ProviderSettings />)
      expect(await screen.findByRole('alert')).toHaveTextContent(/"retired-model" isn't in Groq's current model list/)
      expect(screen.getByDisplayValue('retired-model (not offered by provider)')).toBeInTheDocument()
      expect(getAIConfig().modelByProvider.groq).toBe('retired-model')
    } finally {
      restore()
    }
  })

  it('filters providers inside the dropdown and picks with the keyboard', async () => {
    saveAIConfig({ activeProvider: 'groq', modelByProvider: {}, customProviders: [] })
    render(<ProviderSettings />)

    fireEvent.click(screen.getByRole('button', { name: 'Provider' }))
    const search = screen.getByRole('combobox', { name: 'Search providers' })
    fireEvent.change(search, { target: { value: 'anthro' } })
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent)).toEqual(['Anthropic'])

    fireEvent.keyDown(search, { key: 'Enter' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(getAIConfig().activeProvider).toBe('anthropic')
    await waitFor(() => expect(screen.getByLabelText(/API Key for Anthropic/)).toBeInTheDocument())
  })

  it('Escape closes the dropdown without changing the provider', () => {
    saveAIConfig({ activeProvider: 'groq', modelByProvider: {}, customProviders: [] })
    render(<ProviderSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'Provider' }))
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search providers' }), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(getAIConfig().activeProvider).toBe('groq')
  })
})
