import type { AIProvider, SpeechProvider } from '@sutrata/editor'
import {
  getAIConfig, callAI, callAIStructured, isAIConfigured, subscribeToAICalls,
} from './ai-client'
import { VoiceService } from './voice-service'

/**
 * The OSS app's AIProvider: bring-your-own API key, calling only the provider
 * and model the user picked in Settings. Keys live in the desktop keyring or localStorage — see ai-client.ts.
 *
 * `openSetup` opens the app's onboarding dialog; the app supplies it so the
 * provider object can be created once.
 */
export function createByoKeyAIProvider(openSetup: () => void): AIProvider {
  return {
    id: 'byo-key',
    displayName: 'Your AI provider',
    dataPolicyText:
      'Text is sent directly from this device to the AI provider you configured in Settings, ' +
      'using your own API key, and is subject to that provider\'s data policy. Sutrata does not ' +
      'receive or store it.',
    isConfigured: () => isAIConfigured(getAIConfig()),
    complete: ({ system, prompt }) => callAI(prompt, system ?? '', getAIConfig()),
    completeStructured: ({ system, prompt, schema }) => callAIStructured(prompt, system ?? '', getAIConfig(), schema),
    subscribeActivity: cb =>
      subscribeToAICalls(calls => cb(calls.map(c => ({ label: `${c.providerName} (${c.model})` })))),
    openSetup,
  }
}

/** Live dictation through the browser's Web Speech API. */
export function createWebSpeechProvider(): SpeechProvider {
  const service = new VoiceService()
  return {
    id: 'web-speech',
    displayName: 'Web Speech API',
    isSupported: () => service.isSupported(),
    listen(language, callbacks) {
      service.start(language, callbacks)
      return { stop: () => service.stop(), abort: () => service.abort() }
    },
  }
}
