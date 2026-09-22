import { describe, it, expect, beforeEach } from 'vitest';
import { getAIConfig, saveAIConfig, getApiKey, setApiKey, deleteApiKey, fetchProviders, cleanVoiceResponse } from '../src/ai/ai-client';

describe('AI Client Key Management & Onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return default AIConfig when none is saved', () => {
    const config = getAIConfig();
    expect(config.preferredProvider).toBe('anthropic');
    expect(config.preferredModel).toBe('');
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

  describe('cleanVoiceResponse', () => {
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
