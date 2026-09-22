import { describe, it, expect, beforeEach } from 'vitest';
import { getAIConfig, saveAIConfig, getApiKey, setApiKey, deleteApiKey, fetchProviders, cleanDurationResponse, cleanSynopsisResponse, cleanVoiceResponse } from '../src/ai/ai-client';

describe('AI Client Key Management & Onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return default AIConfig when none is saved', () => {
    const config = getAIConfig();
    expect(config.preferredProvider).toBe('gemini');
    expect(config.preferredModel).toBe('gemma-31b');
    expect(config.customProviders).toEqual([]);
  });

  it('should save and load AIConfig correctly', () => {
    const customConfig = {
      preferredProvider: 'groq',
      preferredModel: 'llama-3.3-70b-versatile',
      customProviders: [
        {
          id: 'local-ollama',
          name: 'Local Ollama',
          baseUrl: 'http://localhost:11434/v1',
          models: [{ id: 'llama3', name: 'Llama 3' }]
        }
      ]
    };
    saveAIConfig(customConfig);
    const loaded = getAIConfig();
    expect(loaded).toEqual(customConfig);
  });

  it('should store and delete API keys in localStorage', async () => {
    const geminiKey = 'test-gemini-key-123';
    await setApiKey('gemini', geminiKey);
    const loadedKey = await getApiKey('gemini');
    expect(loadedKey).toBe(geminiKey);

    await deleteApiKey('gemini');
    const clearedKey = await getApiKey('gemini');
    expect(clearedKey).toBeNull();
  });

  it('should merge custom providers with base providers', async () => {
    const customConfig = {
      preferredProvider: 'local-ollama',
      preferredModel: 'llama3',
      customProviders: [
        {
          id: 'local-ollama',
          name: 'Local Ollama',
          baseUrl: 'http://localhost:11434/v1',
          models: [{ id: 'llama3', name: 'Llama 3' }]
        }
      ]
    };
    const list = await fetchProviders(customConfig);
    const ollama = list.find(p => p.id === 'local-ollama');
    expect(ollama).toBeDefined();
    expect(ollama?.name).toBe('Local Ollama');
    expect(ollama?.models[0]?.id).toBe('llama3');

    // Default provider should still exist
    const gemini = list.find(p => p.id === 'gemini');
    expect(gemini).toBeDefined();
  });

  describe('AI Response Sanitization Helpers', () => {
    it('should clean duration responses and extract the last MM:SS match', () => {
      const inputCluttered = `
        * Dialogue duration: 17 words / 140 wpm approx 7-8 seconds.
        * Action line 1: 4s
        * Action line 2: 4s
        * Estimated range: 00:40 to 00:55.
        * Final refined estimate: 00:45 seems accurate.
      `;
      expect(cleanDurationResponse(inputCluttered)).toBe('00:45');
      expect(cleanDurationResponse('  01:15  ')).toBe('01:15');
      expect(cleanDurationResponse('No duration found')).toBe('No duration found');
    });

    it('should clean synopsis responses and prefer Indic script lines', () => {
      const inputClutteredTamil = `
        * Role: Sutrata's scene synopsis generator.
        * Task: Generate a concise 1-2 sentence synopsis...
        * Conflict: No conflict.
        * Moorthi and Daniel meet at the Golden Tower building, completing a deal.
        * Draft 2 (Tamil):* மூர்த்தியும் டேனியலும் கோல்டன் டவர் கட்டிடத்தில் சந்தித்து ஒரு ஒப்பந்தத்தை நிறைவு செய்கிறார்கள்.
        * Concise? Yes.
      `;
      expect(cleanSynopsisResponse(inputClutteredTamil)).toBe('மூர்த்தியும் டேனியலும் கோல்டன் டவர் கட்டிடத்தில் சந்தித்து ஒரு ஒப்பந்தத்தை நிறைவு செய்கிறார்கள்.');
    });

    it('should clean synopsis responses and fall back to the last draft or first non-meta line', () => {
      const inputClutteredEnglish = `
        * Setting: Office - Day
        * Action: John signs the contract.
        * Draft 1: John signs the document at his office.
        * Draft 2: John signs the contract at his desk, sealing the business deal.
        * Concise? Yes.
      `;
      expect(cleanSynopsisResponse(inputClutteredEnglish)).toBe('John signs the contract at his desk, sealing the business deal.');
    });

    it('should clean voice responses by stripping code blocks, reasoning, and shorthand comments', () => {
      const inputCluttered = `
*   Input: Raw voice transcript "New Scene scene #2 Exterior swimming pool daytime."
    *   Task: Convert to Sutra screenplay format.
    *   Sutra Rules:
        *   Scene Headings: \`##\` (e.g., \`## INT. COFFEE SHOP - DAY\`).
        *   Format: \`## EXT. SWIMMING POOL - DAY {#2}\` (Standard screenplay shorthand for Exterior and Daytime).

    ## EXT. SWIMMING POOL - DAY {#2}
      `;
      expect(cleanVoiceResponse(inputCluttered)).toBe('## EXT. SWIMMING POOL - DAY {#2}');

      const inputWithCodeBlock = '```cine\n## EXT. SWIMMING POOL - DAY {#2}\n```';
      expect(cleanVoiceResponse(inputWithCodeBlock)).toBe('## EXT. SWIMMING POOL - DAY {#2}');

      const inputWithTrailingShorthand = '## EXT. SWIMMING POOL - DAY {#2} (Standard screenplay shorthand for Exterior and Daytime)';
      expect(cleanVoiceResponse(inputWithTrailingShorthand)).toBe('## EXT. SWIMMING POOL - DAY {#2}');

      const userGemmaClutter = `
Rules:
           Scene ID: Append as \`{#ID}\` at the end.

       "7" -> Scene ID {#7}
       "exterior" -> EXT.
       "Road" -> ROAD
       "evening" -> EVENING

    *   \`## EXT. ROAD - EVENING {#7}
      `;
      expect(cleanVoiceResponse(userGemmaClutter)).toBe('## EXT. ROAD - EVENING {#7}');
    });
  });
});
