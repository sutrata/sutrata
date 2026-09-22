import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractJson, listModels, hasConfiguredApiKey, callAI, setApiKey, deleteApiKey, ProviderConfig } from '../src/ai/ai-client';

describe('extractJson', () => {
  it('parses a clean JSON object', () => {
    expect(extractJson<{ synopsis: string; duration: string }>('{"synopsis":"A meets B.","duration":"01:30"}'))
      .toEqual({ synopsis: 'A meets B.', duration: '01:30' });
  });

  it('parses JSON wrapped in a markdown fence', () => {
    const raw = '```json\n{"synopsis":"A meets B.","duration":"01:30"}\n```';
    expect(extractJson<{ synopsis: string; duration: string }>(raw))
      .toEqual({ synopsis: 'A meets B.', duration: '01:30' });
  });

  it('recovers a JSON object embedded in stray commentary', () => {
    const raw = 'Sure, here is the result:\n{"synopsis":"A meets B.","duration":"01:30"}\nHope that helps!';
    expect(extractJson<{ synopsis: string; duration: string }>(raw))
      .toEqual({ synopsis: 'A meets B.', duration: '01:30' });
  });

  it('throws with the raw text attached when nothing parses', () => {
    expect(() => extractJson('not json at all')).toThrow(/AI did not return valid JSON/);
  });
});

describe('listModels', () => {
  it('falls back to the static model list when the live endpoint is unreachable', async () => {
    const provider: ProviderConfig = {
      id: 'made-up-provider',
      name: 'Made Up Provider',
      baseUrl: 'not-a-real-url',
      models: [{ id: 'static-model', name: 'Static Model' }],
    };
    const models = await listModels(provider, 'fake-key');
    expect(models).toEqual(provider.models);
  });
});

describe('preferred-model resolution (regression: wrong provider/model used)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends the user-selected model for the preferred provider, even when that model is not in the static provider list', async () => {
    // Reproduces the reported bug: the user picks a model from a
    // provider's *live* /models listing (e.g. "qwen/qwen3.8-27b" for
    // Groq) via Settings, which is never a member of the narrow static
    // generated-providers.json list. That used to get silently discarded
    // and replaced with the static list's first (often stale/retired)
    // model, making the call fail — or, if another provider's key also
    // happened to be configured, silently fall through to a call against
    // a completely different provider.
    const originalFetch = global.fetch;
    const sentBodies: any[] = [];
    global.fetch = vi.fn(async (url: any, init: any) => {
      if (String(url).includes('api.groq.com')) {
        sentBodies.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
      }
      throw new Error('network unavailable in test');
    }) as any;

    try {
      await setApiKey('groq', 'test-groq-key');
      const config = { preferredProvider: 'groq', preferredModel: 'qwen/qwen3.8-27b', customProviders: [] };

      const result = await callAI('hello', 'system prompt', config);

      expect(result).toBe('ok');
      expect(sentBodies).toHaveLength(1);
      expect(sentBodies[0].model).toBe('qwen/qwen3.8-27b');
    } finally {
      global.fetch = originalFetch;
      await deleteApiKey('groq');
    }
  });
});

describe('hasConfiguredApiKey', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is false with no stored keys and true once one provider has a key', async () => {
    const config = { preferredProvider: 'anthropic', preferredModel: '', customProviders: [] };
    expect(await hasConfiguredApiKey(config)).toBe(false);

    await setApiKey('anthropic', 'test-key');
    expect(await hasConfiguredApiKey(config)).toBe(true);

    await deleteApiKey('anthropic');
  });
});
