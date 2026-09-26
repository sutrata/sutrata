import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createByoKeyAIProvider, createWebSpeechProvider } from '../src/ai/byo-key-providers'
import { mockActiveCallsList, setApiKey, deleteApiKey, saveAIConfig } from '../src/ai/ai-client'

describe('createByoKeyAIProvider', () => {
  beforeEach(async () => {
    localStorage.clear()
    await deleteApiKey('anthropic')
  })

  it('reports configured only once the active provider has a key and a model', async () => {
    const ai = createByoKeyAIProvider(() => {})
    expect(await ai.isConfigured()).toBe(false)
    await setApiKey('anthropic', 'sk-test')
    expect(await ai.isConfigured()).toBe(false)
    saveAIConfig({ activeProvider: 'anthropic', modelByProvider: { anthropic: 'claude-sonnet-5' }, customProviders: [] })
    expect(await ai.isConfigured()).toBe(true)
  })

  it('maps in-flight calls to activity labels', () => {
    const ai = createByoKeyAIProvider(() => {})
    const cb = vi.fn()
    const off = ai.subscribeActivity!(cb)
    expect(cb).toHaveBeenLastCalledWith([])
    mockActiveCallsList([{ providerName: 'Groq', model: 'llama3' }])
    expect(cb).toHaveBeenLastCalledWith([{ label: 'Groq (llama3)' }])
    mockActiveCallsList([])
    off()
  })

  it('openSetup is the callback the app passed in', () => {
    const open = vi.fn()
    createByoKeyAIProvider(open).openSetup!()
    expect(open).toHaveBeenCalled()
  })
})

describe('createWebSpeechProvider', () => {
  it('reports unsupported without the Web Speech API, and listen() reports the error', () => {
    const speech = createWebSpeechProvider()
    expect(speech.isSupported()).toBe(false)
    const onError = vi.fn()
    speech.listen('hi-IN', { onResult: vi.fn(), onError, onEnd: vi.fn() })
    expect(onError).toHaveBeenCalledWith('Web Speech API is not supported in this browser.')
  })
})
