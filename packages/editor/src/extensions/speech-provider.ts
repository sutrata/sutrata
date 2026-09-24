import { createContext, useContext } from 'react'
import { isFeatureEnabled, useSession } from './session'
import { useAI } from './ai-provider'

export interface SpeechRecognitionCallbacks {
  onResult(text: string, isFinal: boolean): void
  onError(error: string): void
  onEnd(): void
}

/** A running live-recognition session. */
export interface SpeechRecognitionSession {
  /** Stop listening; pending results are still delivered. */
  stop(): void
  /** Stop listening and drop pending results. */
  abort(): void
}

/**
 * Speech-to-text, injected by the embedder (OSS spec §11.5). Voice dictation
 * uses live recognition (`listen`) and formats the transcript with the
 * AIProvider, so the voice UI appears only when both are available.
 */
export interface SpeechProvider {
  id: string
  displayName: string
  /** Whether recognition can run here (e.g. the browser has the Web Speech API). */
  isSupported(): boolean
  /** Start live recognition for a BCP-47 language (e.g. `hi-IN`). */
  listen(language: string, callbacks: SpeechRecognitionCallbacks): SpeechRecognitionSession
  /** Optional batch transcription of recorded audio. */
  transcribe?(audio: Blob, opts?: { language?: string }): Promise<string>
}

const SpeechProviderContext = createContext<SpeechProvider | null>(null)

export const SpeechProviderProvider = SpeechProviderContext.Provider

/**
 * The speech provider, or null when voice dictation is unavailable: no speech
 * or AI provider, a session that cannot edit, or `featureFlags.voice` off.
 */
export function useSpeech(): SpeechProvider | null {
  const provider = useContext(SpeechProviderContext)
  const ai = useAI()
  const session = useSession()
  if (!provider || !ai || !isFeatureEnabled(session, 'voice')) return null
  return provider
}
