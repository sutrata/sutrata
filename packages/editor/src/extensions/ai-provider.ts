import { createContext, useContext } from 'react'
import { isFeatureEnabled, useSession } from './session'

/** Opaque JSON Schema object describing a structured response. */
export type JsonSchema = Record<string, unknown>

export interface AIRequest {
  /** System prompt. The editor's prompts (prompts.ts) describe Sutra, not a provider. */
  system?: string
  prompt: string
  signal?: AbortSignal
}

/** One in-flight AI call, for the status bar ("Calling <label>..."). */
export interface AIActivity {
  label: string
}

/**
 * LLM access, injected by the embedder (OSS spec §11.5). The OSS app supplies
 * a bring-your-own-key provider; Sutrata Cloud supplies its own agents.
 * Optional: without one, the editor hides every AI feature.
 */
export interface AIProvider {
  id: string
  displayName: string
  /** Shown before any document content is sent (e.g. AI-assisted import). */
  dataPolicyText: string
  /** Whether a call can succeed right now (e.g. an API key is set). */
  isConfigured(): boolean | Promise<boolean>
  /** Free-text completion. */
  complete(req: AIRequest): Promise<string>
  /** Completion that returns a value matching `schema`; the provider validates/parses it. */
  completeStructured<T = unknown>(req: AIRequest & { schema: JsonSchema }): Promise<T>
  /** Optional: in-flight calls, for the status bar. Calls `cb` immediately with the current list. */
  subscribeActivity?(cb: (calls: AIActivity[]) => void): () => void
  /** Optional: open the embedder's setup UI, used when isConfigured() is false. */
  openSetup?(): void
}

const AIProviderContext = createContext<AIProvider | null>(null)

export const AIProviderProvider = AIProviderContext.Provider

/**
 * The AI provider, or null when AI is unavailable in this session: no
 * provider was injected, the session cannot edit, or `featureFlags.ai` is off.
 * Components hide their AI UI when this is null.
 */
export function useAI(): AIProvider | null {
  const provider = useContext(AIProviderContext)
  const session = useSession()
  if (!provider || session.permission !== 'edit' || !isFeatureEnabled(session, 'ai')) return null
  return provider
}

/** `Calling <label>...` text for the status bar; '' when idle. */
export function formatActivity(calls: AIActivity[]): string {
  if (calls.length === 0) return ''
  if (calls.length === 1) return `Calling ${calls[0]!.label}...`
  const unique = Array.from(new Set(calls.map(c => c.label)))
  if (unique.length === 1) return `Calling ${unique[0]} (${calls.length} calls)...`
  return `Calling ${unique.join(', ')}...`
}
