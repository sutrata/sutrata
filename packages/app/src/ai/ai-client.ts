import bundledProviders from './providers.json';

export interface ModelConfig {
  id: string;
  name: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  /** Custom endpoints only: models to offer when the endpoint has no
   * /models listing. Bundled providers never carry models — they're listed
   * live (see listModels). */
  models?: ModelConfig[];
}

export interface AIConfig {
  /** The provider every AI call goes to. */
  activeProvider: string;
  /** The model chosen for each provider, so switching back restores it. */
  modelByProvider: Record<string, string>;
  /** User-added endpoints; one with a bundled provider's id replaces it. */
  customProviders: ProviderConfig[];
}

/** Opaque JSON Schema object — forwarded into provider request bodies and/or
 * embedded in the prompt text; see callAIStructured. */
export type JsonSchema = Record<string, unknown>;

/** A provider rejected the configured model as unknown/retired. */
export class ModelUnavailableError extends Error {
  constructor(readonly provider: ProviderConfig, readonly model: string) {
    super(`Model "${model}" is no longer available at ${provider.name}. Choose another model in Settings.`);
    this.name = 'ModelUnavailableError';
  }
}

export async function getApiKey(provider: string): Promise<string | null> {
  if (window.desktopAPI?.getApiKey) {
    try {
      return (await window.desktopAPI.getApiKey(provider)) || null;
    } catch (e) {
      console.error('Failed to get key from tauri keyring:', e);
    }
  }
  return localStorage.getItem(`sutrata_api_key_${provider}`);
}

export async function setApiKey(provider: string, key: string): Promise<void> {
  if (window.desktopAPI?.setApiKey) {
    try {
      await window.desktopAPI.setApiKey(provider, key);
      return;
    } catch (e) {
      console.error('Failed to set key in tauri keyring:', e);
    }
  }
  localStorage.setItem(`sutrata_api_key_${provider}`, key);
}

export async function deleteApiKey(provider: string): Promise<void> {
  if (window.desktopAPI?.deleteApiKey) {
    try {
      await window.desktopAPI.deleteApiKey(provider);
      return;
    } catch (e) {
      console.error('Failed to delete key from tauri keyring:', e);
    }
  }
  localStorage.removeItem(`sutrata_api_key_${provider}`);
}

const CONFIG_STORAGE_KEY = 'sutrata_ai_settings';

export function getAIConfig(): AIConfig {
  const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  return { activeProvider: 'anthropic', modelByProvider: {}, customProviders: [] };
}

export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

/** Custom endpoints may run without a key (local servers); bundled cloud
 * providers always need one. */
export function isKeyOptional(config: AIConfig, providerId: string): boolean {
  return config.customProviders.some(p => p.id === providerId);
}

/** The bundled provider list (src/ai/providers.json, refreshed with
 * `pnpm providers:update`) plus the user's custom endpoints. */
export function getProviders(config: AIConfig): ProviderConfig[] {
  const custom = new Map(config.customProviders.map(p => [p.id, p]));
  const list: ProviderConfig[] = bundledProviders.providers.map(p => custom.get(p.id) ?? p);
  for (const c of config.customProviders) {
    if (!list.includes(c)) list.push(c);
  }
  return list;
}

interface ApiResponse {
  status: number;
  data: any;
}

async function requestHttp(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: any
): Promise<ApiResponse> {
  if (window.desktopAPI?.callProviderApi) {
    try {
      const res = await window.desktopAPI.callProviderApi(url, method, headers, body);
      return res;
    } catch (e) {
      throw new Error(`Desktop API Error: ${e}`);
    }
  } else {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return {
        status: res.status,
        data,
      };
    } catch (e) {
      throw new Error(`Web Fetch Error: ${e}`);
    }
  }
}

const STRUCTURED_TOOL_NAME = 'emit_result';

/** Auth headers for a provider. An empty key (a custom endpoint, e.g. a local
 * Ollama/LM Studio server) sends no credentials at all. */
function authHeaders(provider: ProviderConfig, key: string): Record<string, string> {
  if (provider.id === 'anthropic') {
    return {
      ...(key ? { 'x-api-key': key } : {}),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }
  return key ? { 'Authorization': `Bearer ${key}` } : {};
}

/**
 * Anthropic has no OpenAI-compatible endpoint, so it's the only provider
 * that still needs a bespoke request/response shape here — everyone else
 * (including Gemini, via its official /v1beta/openai compat base URL) goes
 * through the generic OpenAI-compatible branch below.
 */
async function invokeProvider(
  provider: ProviderConfig,
  model: string,
  key: string,
  prompt: string,
  systemPrompt: string,
  responseSchema?: JsonSchema
): Promise<string> {
  let url = '';
  let headers: Record<string, string> = {};
  let body: any = null;
  const method = 'POST';

  if (provider.id === 'anthropic') {
    url = `${provider.baseUrl}/messages`;
    headers = { ...authHeaders(provider, key), 'content-type': 'application/json' };
    body = {
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    };
    if (responseSchema) {
      // Force a schema-valid tool call instead of parsing free text —
      // guarantees the fields we asked for, in the shape we asked for.
      body.tools = [{
        name: STRUCTURED_TOOL_NAME,
        description: 'Return the structured result for this request.',
        input_schema: responseSchema,
        strict: true,
      }];
      body.tool_choice = { type: 'tool', name: STRUCTURED_TOOL_NAME };
    }
  } else {
    url = `${provider.baseUrl}/chat/completions`;
    headers = { ...authHeaders(provider, key), 'Content-Type': 'application/json' };
    const effectiveSystemPrompt = responseSchema
      ? `${systemPrompt}\n\n[OUTPUT FORMAT]\nRespond with ONLY a single JSON object matching this JSON schema — no markdown fences, no commentary, no extra text before or after it:\n${JSON.stringify(responseSchema)}`
      : systemPrompt;
    body = {
      model,
      messages: [
        { role: 'system', content: effectiveSystemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    };
    if (responseSchema) {
      // Broadest-compatibility structured-output mode — many self-hosted/
      // aggregator OpenAI-compatible backends don't support the stricter
      // json_schema mode, so this is paired with the prompt instruction
      // above and extractJson()'s tolerant parsing on the caller side.
      body.response_format = { type: 'json_object' };
    }
  }

  const res = await requestHttp(url, method, headers, body);
  if (res.status === 429) {
    throw new Error(`Rate limit exceeded (HTTP 429)`);
  }
  if (res.status < 200 || res.status >= 300) {
    const errMsg = typeof res.data === 'object'
      ? JSON.stringify(res.data)
      : String(res.data);
    if (isModelUnavailable(res.status, errMsg)) throw new ModelUnavailableError(provider, model);
    throw new Error(`HTTP ${res.status}: ${errMsg}`);
  }

  if (provider.id === 'anthropic') {
    if (responseSchema) {
      const toolUse = (res.data?.content as any[] | undefined)?.find(
        (block) => block?.type === 'tool_use' && block?.name === STRUCTURED_TOOL_NAME
      );
      if (!toolUse) throw new Error('Invalid response from Anthropic: missing tool_use block');
      return JSON.stringify(toolUse.input);
    }
    const text = res.data?.content?.[0]?.text;
    if (!text) throw new Error('Invalid response from Anthropic: missing content text');
    return text;
  } else {
    const text = res.data?.choices?.[0]?.message?.content;
    if (!text) throw new Error(`Invalid response from ${provider.name}: missing message content`);
    return text;
  }
}

/**
 * Whether an error response means the provider doesn't know (or has retired)
 * the requested model: Anthropic's 404 not_found_error on "model: …",
 * OpenAI's model_not_found, Groq's model_decommissioned, and similar.
 */
function isModelUnavailable(status: number, body: string): boolean {
  if (status !== 400 && status !== 404) return false;
  const text = body.toLowerCase();
  return text.includes('model')
    && /not[ _]?found|does not exist|decommission|deprecated|no longer|invalid model|unknown model/.test(text);
}

/**
 * Parses a structured AI response into T, tolerating a model that wraps the
 * JSON in a markdown fence or adds stray text around it despite being asked
 * not to (some providers don't strictly honor response_format hints).
 */
export function extractJson<T>(raw: string): T {
  const attempts: string[] = [raw.trim()];

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) attempts.push(fenceMatch[1].trim());

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(raw.slice(firstBrace, lastBrace + 1));
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as T;
    } catch {
      continue;
    }
  }

  throw new Error(`AI did not return valid JSON: ${raw.slice(0, 200)}`);
}

export function cleanVoiceResponse(text: string): string {
  let cleaned = text.trim();
  // Strip markdown code block wrapper if present
  cleaned = cleaned.replace(/^```[a-zA-Z0-9]*\n/, '').replace(/\n```$/, '');

  const lines = cleaned.split('\n');
  const filteredLines = lines.map(line => {
    let l = line.trim();
    // Strip leading list bullet (e.g. *, -, +, •) and spaces
    l = l.replace(/^[*•\-+]\s*/, '').trim();
    // Strip leading/trailing backticks if any
    l = l.replace(/^`+/, '').replace(/`+$/, '').trim();
    
    // Strip common explanatory trailing comments in parens
    l = l.replace(/\s*\(Standard screenplay shorthand[^)]*\)/gi, '');
    l = l.replace(/\s*\(Standard shorthand[^)]*\)/gi, '');
    return l;
  }).filter(line => {
    const trimmed = line.toLowerCase();
    // Keep blank lines: they separate Sutra blocks (a blank line ends dialogue).
    if (!trimmed) return true;

    // Discard reasoning/mapping/explanation patterns
    if (
      trimmed.includes('->') ||
      trimmed.includes('=>') ||
      trimmed.startsWith('input:') ||
      trimmed.startsWith('task:') ||
      trimmed.startsWith('rules:') ||
      trimmed.startsWith('instructions:') ||
      trimmed.startsWith('sutra rules:') ||
      trimmed.startsWith('scene headings:') ||
      trimmed.startsWith('scene id:') ||
      trimmed.startsWith('characters:') ||
      trimmed.startsWith('parentheticals:') ||
      trimmed.startsWith('dialogue:') ||
      trimmed.startsWith('transitions:') ||
      trimmed.startsWith('lyrics:') ||
      trimmed.startsWith('action:') ||
      trimmed.startsWith('format:') ||
      trimmed.startsWith('components:') ||
      trimmed.startsWith('output only') ||
      trimmed.startsWith('no markdown') ||
      trimmed.includes('convert it into valid sutra') ||
      trimmed.includes('sutra syntax rules') ||
      trimmed.includes('clearly a scene heading') ||
      trimmed.includes('screenplay shorthand') ||
      trimmed.includes('append as')
    ) {
      return false;
    }

    return true;
  });

  // Collapse runs of blank lines left behind by discarded explanation lines.
  return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

let nextCallId = 0;
const activeCalls = new Map<string, { providerName: string; model: string }>();
const subscribers = new Set<(calls: { providerName: string; model: string }[]) => void>();

export function subscribeToAICalls(callback: (calls: { providerName: string; model: string }[]) => void): () => void {
  subscribers.add(callback);
  callback(Array.from(activeCalls.values()));
  return () => {
    subscribers.delete(callback);
  };
}

function notifySubscribers() {
  const list = Array.from(activeCalls.values());
  for (const sub of subscribers) {
    sub(list);
  }
}

/**
 * Resolves the active provider, its key and chosen model, and invokes it.
 * Shared by callAI and callAIStructured so the two don't duplicate this
 * logic. Only the active provider is ever called, and a model is never
 * substituted: a failure surfaces as an error naming the provider/model.
 */
async function resolveAndInvoke(
  prompt: string,
  systemPrompt: string,
  config: AIConfig,
  responseSchema?: JsonSchema
): Promise<string> {
  const provider = getProviders(config).find(p => p.id === config.activeProvider);
  if (!provider) {
    throw new Error(`Unknown AI provider "${config.activeProvider}". Choose a provider in Settings.`);
  }

  const key = (await getApiKey(provider.id)) ?? '';
  if (!key && !isKeyOptional(config, provider.id)) {
    throw new Error(`No API key configured for ${provider.name}. Add one in Settings.`);
  }

  const model = config.modelByProvider[provider.id];
  if (!model) {
    throw new Error(`No model selected for ${provider.name}. Choose one in Settings.`);
  }

  const callId = `call-${nextCallId++}`;
  activeCalls.set(callId, { providerName: provider.name, model });
  notifySubscribers();

  try {
    return await invokeProvider(provider, model, key, prompt, systemPrompt, responseSchema);
  } catch (e: any) {
    if (e instanceof ModelUnavailableError) throw e;
    throw new Error(`AI generation failed. [${provider.name} / ${model}] ${e.message || String(e)}`);
  } finally {
    activeCalls.delete(callId);
    notifySubscribers();
  }
}

export async function callAI(
  prompt: string,
  systemPrompt: string,
  config: AIConfig
): Promise<string> {
  return resolveAndInvoke(prompt, systemPrompt, config);
}

/**
 * Like callAI, but requests and validates a JSON response matching `schema`
 * instead of returning free text — the explicit contract that replaced
 * sniffing the system prompt for keywords like "duration"/"synopsis".
 */
export async function callAIStructured<T = unknown>(
  prompt: string,
  systemPrompt: string,
  config: AIConfig,
  schema: JsonSchema
): Promise<T> {
  const response = await resolveAndInvoke(prompt, systemPrompt, config, schema);
  return extractJson<T>(response);
}

/** The active provider has a chosen model and, unless it's a custom
 * endpoint, a key — i.e. callAI can run. */
export async function isAIConfigured(config: AIConfig): Promise<boolean> {
  if (!config.modelByProvider[config.activeProvider]) return false;
  if (!getProviders(config).some(p => p.id === config.activeProvider)) return false;
  return isKeyOptional(config, config.activeProvider) || !!(await getApiKey(config.activeProvider));
}

export type ModelListResult =
  | { ok: true; models: ModelConfig[]; fetchedAt: number }
  | { ok: false; error: string };

const MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const modelCacheKey = (providerId: string) => `sutrata_models_${providerId}`;

/** Cheap fingerprint of the API key (FNV-1a), so a changed key invalidates
 * the cached model list without storing the key itself alongside it. */
function keyFingerprint(apiKey: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < apiKey.length; i++) {
    hash ^= apiKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/** Model ids that are obviously not chat models (embeddings, speech, image,
 * video, moderation…) — /models endpoints list everything the key can use. */
const NON_CHAT_MODEL = /embed|whisper|tts|transcri|speech|dall-e|image|imagen|veo|moderation|rerank|realtime|audio|aqa/i;

/**
 * Lists the models the provider currently offers, from its /models endpoint,
 * cached per provider for 24 hours (keyed to the API key, so a new key
 * refetches; `refresh` bypasses the cache). Never throws: a failed listing
 * (offline, bad key, rate limit, no /models route) returns `ok: false` — that
 * means "couldn't check", not that any model is unavailable.
 */
export async function listModels(
  provider: ProviderConfig,
  apiKey: string,
  { refresh = false }: { refresh?: boolean } = {}
): Promise<ModelListResult> {
  const fingerprint = keyFingerprint(apiKey);
  if (!refresh) {
    try {
      const cached = JSON.parse(localStorage.getItem(modelCacheKey(provider.id)) ?? 'null');
      if (cached?.fingerprint === fingerprint && Date.now() - cached.fetchedAt < MODEL_CACHE_TTL_MS) {
        return { ok: true, models: cached.models, fetchedAt: cached.fetchedAt };
      }
    } catch {
      // unreadable cache entry: refetch
    }
  }

  try {
    const isAnthropic = provider.id === 'anthropic';
    // Anthropic paginates (default page size 20); 1000 is its maximum.
    const url = `${provider.baseUrl}/models${isAnthropic ? '?limit=1000' : ''}`;
    const res = await requestHttp(url, 'GET', authHeaders(provider, apiKey), null);
    if (res.status < 200 || res.status >= 300) {
      const detail = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);
      throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }

    const data = res.data?.data;
    if (!Array.isArray(data)) {
      throw new Error('Provider did not return a model list');
    }

    const models: ModelConfig[] = data
      // Gemini's OpenAI-compatible listing prefixes ids with "models/"; its
      // chat endpoint takes the bare id.
      .map((m: any) => ({ ...m, id: String(m.id).replace(/^models\//, '') }))
      .filter((m: any) => !NON_CHAT_MODEL.test(m.id))
      // OpenRouter-style listings say what each model outputs.
      .filter((m: any) => !Array.isArray(m.architecture?.output_modalities) || m.architecture.output_modalities.includes('text'))
      .map((m: any) => ({ id: m.id, name: m.display_name || m.name || m.id }));

    const fetchedAt = Date.now();
    localStorage.setItem(modelCacheKey(provider.id), JSON.stringify({ fingerprint, fetchedAt, models }));
    return { ok: true, models, fetchedAt };
  } catch (e: any) {
    console.warn(`Failed to list models for ${provider.id}:`, e);
    return { ok: false, error: e.message || String(e) };
  }
}

/**
 * Verifies the key: with a model, by a one-word completion against it;
 * without one, by listing the provider's models (no tokens spent).
 */
export async function testConnection(provider: ProviderConfig, apiKey: string, model?: string): Promise<void> {
  if (model) {
    const text = await invokeProvider(provider, model, apiKey, 'Hello, reply with one word: OK', 'Connection test verification.');
    if (!text.trim()) throw new Error('Empty response from provider.');
    return;
  }
  const result = await listModels(provider, apiKey, { refresh: true });
  if (!result.ok) throw new Error(result.error);
}

export function mockActiveCallsList(calls: { providerName: string; model: string }[]) {
  activeCalls.clear();
  calls.forEach((c, idx) => activeCalls.set(`mock-${idx}`, c));
  notifySubscribers();
}

