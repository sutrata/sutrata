import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractJson, listModels, isAIConfigured, callAI, setApiKey, deleteApiKey, ModelUnavailableError, ProviderConfig } from '../src/ai/ai-client';

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

const groq: ProviderConfig = { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' };

/** Replaces fetch; `handler` gets the URL and parsed body, returns [status, json]. */
function mockFetch(handler: (url: string, body: any) => [number, unknown]) {
  const original = global.fetch;
  const calls: { url: string; body: any }[] = [];
  global.fetch = vi.fn(async (url: any, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), body });
    const [status, json] = handler(String(url), body);
    return new Response(JSON.stringify(json), { status });
  }) as any;
  return { calls, restore: () => { global.fetch = original; } };
}

describe('listModels', () => {
  beforeEach(() => localStorage.clear());

  it('reports a failed listing as not ok instead of guessing a model list', async () => {
    const provider: ProviderConfig = { id: 'made-up-provider', name: 'Made Up', baseUrl: 'not-a-real-url' };
    const result = await listModels(provider, 'fake-key');
    expect(result.ok).toBe(false);
  });

  it('drops non-chat models and strips Gemini-style "models/" prefixes', async () => {
    const f = mockFetch(() => [200, { data: [
      { id: 'llama-3.3-70b-versatile' },
      { id: 'whisper-large-v3' },
      { id: 'text-embedding-3-small' },
      { id: 'models/gemini-2.5-flash', display_name: 'Gemini 2.5 Flash' },
      { id: 'flux-image', architecture: { output_modalities: ['image'] } },
    ] }]);
    try {
      const result = await listModels(groq, 'k');
      expect(result.ok && result.models).toEqual([
        { id: 'llama-3.3-70b-versatile', name: 'llama-3.3-70b-versatile' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      ]);
    } finally {
      f.restore();
    }
  });

  it('caches for 24 hours per key; a new key or refresh refetches', async () => {
    const f = mockFetch(() => [200, { data: [{ id: 'm1' }] }]);
    const now = vi.spyOn(Date, 'now');
    try {
      now.mockReturnValue(1_000_000);
      await listModels(groq, 'key-a');
      await listModels(groq, 'key-a');
      expect(f.calls).toHaveLength(1);

      await listModels(groq, 'key-b');
      expect(f.calls).toHaveLength(2);

      await listModels(groq, 'key-b', { refresh: true });
      expect(f.calls).toHaveLength(3);

      now.mockReturnValue(1_000_000 + 24 * 60 * 60 * 1000 + 1);
      await listModels(groq, 'key-b');
      expect(f.calls).toHaveLength(4);
    } finally {
      now.mockRestore();
      f.restore();
    }
  });
});

describe('callAI provider/model resolution', () => {
  beforeEach(() => localStorage.clear());

  it('sends the model chosen for the active provider', async () => {
    const f = mockFetch(() => [200, { choices: [{ message: { content: 'ok' } }] }]);
    try {
      await setApiKey('groq', 'test-groq-key');
      const config = { activeProvider: 'groq', modelByProvider: { groq: 'qwen/qwen3.8-27b', anthropic: 'claude-sonnet-5' }, customProviders: [] };
      expect(await callAI('hello', 'system prompt', config)).toBe('ok');
      expect(f.calls.map(c => c.url)).toEqual(['https://api.groq.com/openai/v1/chat/completions']);
      expect(f.calls[0]!.body.model).toBe('qwen/qwen3.8-27b');
    } finally {
      f.restore();
    }
  });

  it('never calls another configured provider when the active one fails', async () => {
    const f = mockFetch(url => url.includes('groq') ? [500, { error: 'boom' }] : [200, { content: [{ type: 'text', text: 'wrong provider' }] }]);
    try {
      await setApiKey('groq', 'test-groq-key');
      await setApiKey('anthropic', 'test-anthropic-key');
      const config = { activeProvider: 'groq', modelByProvider: { groq: 'some-model', anthropic: 'claude-sonnet-5' }, customProviders: [] };
      await expect(callAI('hello', 'system prompt', config)).rejects.toThrow(/Groq \/ some-model/);
      expect(f.calls).toHaveLength(1);
    } finally {
      f.restore();
    }
  });

  it('reports a retired model as ModelUnavailableError', async () => {
    const f = mockFetch(() => [400, { error: { message: 'The model `old-model` has been decommissioned', code: 'model_decommissioned' } }]);
    try {
      await setApiKey('groq', 'test-groq-key');
      const config = { activeProvider: 'groq', modelByProvider: { groq: 'old-model' }, customProviders: [] };
      const error = await callAI('hello', 'system', config).catch(e => e);
      expect(error).toBeInstanceOf(ModelUnavailableError);
      expect(error.message).toMatch(/"old-model" is no longer available at Groq/);
    } finally {
      f.restore();
    }
  });

  it('errors without a key or a model for the active provider — no substitution', async () => {
    await setApiKey('anthropic', 'test-anthropic-key');
    await expect(callAI('hi', 's', { activeProvider: 'groq', modelByProvider: { groq: 'm' }, customProviders: [] }))
      .rejects.toThrow(/No API key configured for Groq/);
    await setApiKey('groq', 'test-groq-key');
    await expect(callAI('hi', 's', { activeProvider: 'groq', modelByProvider: {}, customProviders: [] }))
      .rejects.toThrow(/No model selected for Groq/);
  });
});

describe('custom endpoints without a key', () => {
  beforeEach(() => localStorage.clear());

  const ollama = { id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1' };
  const config = { activeProvider: 'ollama', modelByProvider: { ollama: 'llama3' }, customProviders: [ollama] };

  it('lists models and calls the endpoint with no Authorization header', async () => {
    const original = global.fetch;
    const headers: Record<string, string>[] = [];
    global.fetch = vi.fn(async (url: any, init: any) => {
      headers.push(init?.headers ?? {});
      return String(url).endsWith('/models')
        ? new Response(JSON.stringify({ data: [{ id: 'llama3' }] }), { status: 200 })
        : new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    }) as any;
    try {
      const listed = await listModels(ollama, '');
      expect(listed.ok && listed.models.map(m => m.id)).toEqual(['llama3']);
      expect(await callAI('hi', 's', config)).toBe('ok');
      expect(headers.every(h => !('Authorization' in h))).toBe(true);
    } finally {
      global.fetch = original;
    }
  });

  it('counts as configured with just a model', async () => {
    expect(await isAIConfigured(config)).toBe(true);
  });
});

describe('isAIConfigured', () => {
  beforeEach(() => localStorage.clear());

  it('needs a key and a model for the active provider', async () => {
    const config = { activeProvider: 'anthropic', modelByProvider: { anthropic: 'claude-sonnet-5' }, customProviders: [] };
    expect(await isAIConfigured(config)).toBe(false);
    await setApiKey('anthropic', 'test-key');
    expect(await isAIConfigured(config)).toBe(true);
    expect(await isAIConfigured({ ...config, modelByProvider: {} })).toBe(false);
    await deleteApiKey('anthropic');
  });
});
