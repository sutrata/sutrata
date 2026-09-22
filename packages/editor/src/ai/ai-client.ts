export interface AIConfig {
  preferredProvider: string;
  preferredModel: string;
  customProviders: CustomProvider[];
}

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: { id: string; name: string }[];
}

export interface ModelConfig {
  id: string;
  name: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  models: ModelConfig[];
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

export function getAIConfig(): AIConfig {
  const stored = localStorage.getItem('sutrata_ai_config');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  return {
    preferredProvider: 'gemini',
    preferredModel: 'gemma-31b',
    customProviders: [],
  };
}

export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem('sutrata_ai_config', JSON.stringify(config));
}

let cachedProviders: ProviderConfig[] | null = null;

export async function fetchProviders(config?: AIConfig): Promise<ProviderConfig[]> {
  if (cachedProviders) {
    return mergeCustomProviders(cachedProviders, config?.customProviders);
  }

  const isProd = (import.meta as any).env?.PROD;
  const githubUrl = 'https://raw.githubusercontent.com/sivarajd/sutrata/main/packages/app/public/models-config.json';
  
  let providers: ProviderConfig[] = [];
  
  if (isProd) {
    try {
      const res = await fetch(githubUrl);
      if (res.ok) {
        const data = await res.json();
        providers = data.providers || [];
      }
    } catch (e) {
      console.warn('Failed to fetch models config from github raw URL, falling back to local:', e);
    }
  }

  if (providers.length === 0) {
    try {
      const res = await fetch('/models-config.json');
      if (res.ok) {
        const data = await res.json();
        providers = data.providers || [];
      }
    } catch (e) {
      console.error('Failed to fetch local models-config.json:', e);
      // Fallback defaults if both network and local public fetch fail
      providers = [
        {
          id: 'gemini',
          name: 'Google AI Studio (Gemini)',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
          models: [
            { id: 'gemma-31b', name: 'Gemma 31B' },
            { id: 'gemma-26b', name: 'Gemma 26B' },
            { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' }
          ]
        },
        {
          id: 'groq',
          name: 'Groq',
          baseUrl: 'https://api.groq.com/openai/v1',
          models: [
            { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
            { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
            { id: 'gemma2-9b-it', name: 'Gemma 2 9B' }
          ]
        },
        {
          id: 'anthropic',
          name: 'Anthropic (Claude)',
          baseUrl: 'https://api.anthropic.com/v1',
          models: [
            { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' }
          ]
        }
      ];
    }
  }

  cachedProviders = providers;
  return mergeCustomProviders(providers, config?.customProviders);
}

function mergeCustomProviders(
  base: ProviderConfig[],
  custom: CustomProvider[] | undefined
): ProviderConfig[] {
  if (!custom || custom.length === 0) return base;
  const list = [...base];
  for (const c of custom) {
    const index = list.findIndex(p => p.id === c.id);
    if (index >= 0) {
      const existing = list[index]!;
      list[index] = {
        ...existing,
        name: c.name,
        baseUrl: c.baseUrl,
        models: c.models,
      };
    } else {
      list.push({
        id: c.id,
        name: c.name,
        baseUrl: c.baseUrl,
        models: c.models,
      });
    }
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

async function invokeProvider(
  provider: ProviderConfig,
  model: string,
  key: string,
  prompt: string,
  systemPrompt: string
): Promise<string> {
  let url = '';
  let headers: Record<string, string> = {};
  let body: any = null;
  const method = 'POST';

  if (provider.id === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    headers = {
      'Content-Type': 'application/json',
    };
    body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          { text: systemPrompt }
        ]
      },
      generationConfig: {
        temperature: 0.1,
      }
    };
  } else if (provider.id === 'anthropic') {
    url = `${provider.baseUrl}/messages`;
    headers = {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
    body = {
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    };
  } else {
    url = `${provider.baseUrl}/chat/completions`;
    headers = {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
    body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    };
  }

  const res = await requestHttp(url, method, headers, body);
  if (res.status === 429) {
    throw new Error(`Rate limit exceeded (HTTP 429)`);
  }
  if (res.status < 200 || res.status >= 300) {
    const errMsg = typeof res.data === 'object'
      ? JSON.stringify(res.data)
      : res.data;
    throw new Error(`HTTP ${res.status}: ${errMsg}`);
  }

  if (provider.id === 'gemini') {
    const candidate = res.data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Invalid response from Gemini: missing content parts');
    return text;
  } else if (provider.id === 'anthropic') {
    const text = res.data?.content?.[0]?.text;
    if (!text) throw new Error('Invalid response from Anthropic: missing content text');
    return text;
  } else {
    const text = res.data?.choices?.[0]?.message?.content;
    if (!text) throw new Error(`Invalid response from ${provider.name}: missing message content`);
    return text;
  }
}

export function cleanDurationResponse(text: string): string {
  const matches = [...text.matchAll(/\b\d{2}:\d{2}\b/g)]
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1]
    if (lastMatch && lastMatch[0]) {
      return lastMatch[0]
    }
  }
  return text.trim()
}

function stripPrefix(text: string): string {
  return text.replace(/^[a-z0-9\s()\-._]+:\s*[*#-]?\s*/i, '').trim()
}

export function cleanSynopsisResponse(text: string): string {
  let lines = text.split('\n')
    .map(line => line.trim().replace(/^[\s*\-+\d\.]+\s*/, '').trim())
    .filter(Boolean)
  if (lines.length === 0) return ''

  const indicRegex = /[\u0900-\u0DFF]/
  const indicLines = lines.filter(line => indicRegex.test(line))
  if (indicLines.length > 0) {
    return stripPrefix(indicLines[0]!)
  }

  const draftLines = lines.filter(line => /draft\s*\d+/i.test(line))
  if (draftLines.length > 0) {
    const lastDraft = draftLines[draftLines.length - 1]!
    return stripPrefix(lastDraft)
  }

  const filtered = lines.filter(line => {
    const lower = line.toLowerCase()
    return !lower.startsWith('role:') &&
           !lower.startsWith('task:') &&
           !lower.startsWith('constraints:') &&
           !lower.startsWith('setting:') &&
           !lower.startsWith('characters:') &&
           !lower.startsWith('action:') &&
           !lower.startsWith('conflict:') &&
           !lower.startsWith('input:') &&
           !lower.startsWith('synopsis:') &&
           !/concise\?\s*yes/i.test(line) &&
           !/sentences\?\s*yes/i.test(line) &&
           !/only synopsis\s*(text)?\?\s*yes/i.test(line) &&
           !/language match\?\s*yes/i.test(line) &&
           !/main action\/conflict\?/i.test(line)
  })

  if (filtered.length > 0) {
    return stripPrefix(filtered[0]!)
  }

  return stripPrefix(lines[0]!)
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
    if (!trimmed) return false;

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

  return filteredLines.join('\n').trim();
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

export function formatActiveCalls(calls: { providerName: string; model: string }[]): string {
  if (calls.length === 0) return '';
  if (calls.length === 1) {
    return `Calling ${calls[0]!.providerName} (${calls[0]!.model})...`;
  }
  const unique = Array.from(new Set(calls.map(c => `${c.providerName} (${c.model})`)));
  if (unique.length === 1) {
    return `Calling ${unique[0]} (${calls.length} calls)...`;
  }
  return `Calling ${unique.join(', ')}...`;
}

export async function callAI(
  prompt: string,
  systemPrompt: string,
  config: AIConfig
): Promise<string> {
  const providers = await fetchProviders(config);
  
  const availableProviders: string[] = [];
  for (const p of providers) {
    const key = await getApiKey(p.id);
    if (key) {
      availableProviders.push(p.id);
    }
  }

  if (availableProviders.length === 0) {
    throw new Error('No AI API keys configured. Please configure keys in Settings.');
  }

  let providersToTry = [config.preferredProvider, ...availableProviders.filter(p => p !== config.preferredProvider)];
  providersToTry = providersToTry.filter(p => availableProviders.includes(p));

  if (providersToTry.length === 0) {
    providersToTry = [availableProviders[0]!];
  }

  let lastError = '';

  for (const providerId of providersToTry) {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) continue;

    const key = await getApiKey(providerId);
    if (!key) continue;

    let model = config.preferredModel;
    if (!provider.models.some(m => m.id === model)) {
      model = provider.models[0]?.id || '';
    }

    const callId = `call-${nextCallId++}`;
    activeCalls.set(callId, { providerName: provider.name, model });
    notifySubscribers();

    try {
      const response = await invokeProvider(provider, model, key, prompt, systemPrompt);
      if (systemPrompt.includes('duration')) {
        return cleanDurationResponse(response);
      }
      if (systemPrompt.includes('synopsis')) {
        return cleanSynopsisResponse(response);
      }
      if (systemPrompt.includes('AI screenplay formatter')) {
        return cleanVoiceResponse(response);
      }
      return response;
    } catch (e: any) {
      console.warn(`Provider ${providerId} failed:`, e);
      lastError = e.message || String(e);
      continue;
    } finally {
      activeCalls.delete(callId);
      notifySubscribers();
    }
  }

  throw new Error(`AI generation failed. Last error: ${lastError}`);
}

export async function testConnection(providerId: string, apiKey: string, config: AIConfig): Promise<boolean> {
  const providers = await fetchProviders(config);
  const provider = providers.find(p => p.id === providerId);
  if (!provider) throw new Error('Unknown provider');

  const testModel = provider.models[0]?.id;
  if (!testModel) throw new Error('No models found for provider');

  const resText = await invokeProvider(provider, testModel, apiKey, "Hello, reply with one word: OK", "Connection test verification.");
  return resText.trim().length > 0;
}

export function mockActiveCallsList(calls: { providerName: string; model: string }[]) {
  activeCalls.clear();
  calls.forEach((c, idx) => activeCalls.set(`mock-${idx}`, c));
  notifySubscribers();
}

