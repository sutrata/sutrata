import { vi } from 'vitest'
import type { AIProvider, AIActivity } from '../../src/extensions/ai-provider'
import type { SpeechProvider } from '../../src/extensions/speech-provider'

/** An AIProvider whose calls are vi.fn()s; `setActivity` drives subscribeActivity. */
export function stubAIProvider(overrides: Partial<AIProvider> = {}) {
  const listeners = new Set<(calls: AIActivity[]) => void>()
  let activity: AIActivity[] = []
  const provider = {
    id: 'stub-ai',
    displayName: 'Stub AI',
    dataPolicyText: 'Stub: nothing leaves this test.',
    isConfigured: vi.fn(() => true),
    complete: vi.fn(async () => '## INT. STUB - DAY'),
    completeStructured: vi.fn(async () => ({ synopsis: 'Stub synopsis.', duration: '01:00' })),
    subscribeActivity: vi.fn((cb: (calls: AIActivity[]) => void) => {
      listeners.add(cb)
      cb(activity)
      return () => { listeners.delete(cb) }
    }),
    openSetup: vi.fn(),
    ...overrides,
  }
  return Object.assign(provider as AIProvider & typeof provider, {
    setActivity(next: AIActivity[]) {
      activity = next
      for (const l of listeners) l(activity)
    },
  })
}

export function stubSpeechProvider(overrides: Partial<SpeechProvider> = {}) {
  return {
    id: 'stub-speech',
    displayName: 'Stub Speech',
    isSupported: vi.fn(() => true),
    listen: vi.fn(() => ({ stop: vi.fn(), abort: vi.fn() })),
    ...overrides,
  } satisfies SpeechProvider
}
