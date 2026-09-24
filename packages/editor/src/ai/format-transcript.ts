import type { AIProvider } from '../extensions/ai-provider'
import { VOICE_FORMAT_SYSTEM_PROMPT } from './prompts'
import { cleanVoiceResponse } from './clean-response'

/** Format a dictated (or selected) transcript as Sutra with the injected AI provider. */
export async function formatTranscript(ai: AIProvider, transcript: string, langCode: string): Promise<string> {
  const prompt = `Raw Voice Transcript (${langCode}):\n"${transcript}"`
  return cleanVoiceResponse(await ai.complete({ system: VOICE_FORMAT_SYSTEM_PROMPT, prompt }))
}
