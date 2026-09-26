// Regenerates src/ai/providers.json from the community-maintained
// all-llm-provider-list registry. Run by hand (`pnpm providers:update`) and
// commit the result — the build never fetches it, and the app never loads a
// provider list from the network: a provider's baseUrl is where the user's
// API key gets sent, so the list only changes through a reviewed commit.
//
// No models are stored: the app lists them live from each provider's
// /models endpoint once the user has entered a key.
//
// Only providers Sutrata can actually drive are kept: ones with a real
// env_variable (a "paste an API key" auth model — this drops OAuth/
// browser-cookie/no-auth entries), an https base URL (drops localhost
// servers; add those as custom endpoints), and either openai_compatible:
// true or Anthropic (the one vendor ai-client.ts calls with a bespoke
// request shape).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'src/ai/providers.json');

const SOURCE_REPO = 'https://github.com/foisalislambd/all-llm-provider-list';
const SOURCE_URL = 'https://raw.githubusercontent.com/foisalislambd/all-llm-provider-list/main/data/providers.json';

// Vendors Sutrata treats specially. Ids double as API-key storage suffixes
// (sutrata_api_key_<id>) and, for anthropic, as invokeProvider's branch
// discriminator, so they're pinned regardless of the upstream slug. Google
// is retargeted at its OpenAI-compatible base URL so it needs no adapter.
const OVERRIDES = {
  anthropic: { id: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  'google-ai-studio': { id: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
};
OVERRIDES.gemini = OVERRIDES['google-ai-studio'];
OVERRIDES.google = OVERRIDES['google-ai-studio'];

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function toProvider(entry) {
  const override = OVERRIDES[entry.slug];
  if (!entry.env_variable) return null;
  if (entry.openai_compatible !== true && override?.id !== 'anthropic') return null;
  const baseUrl = (override?.baseUrl ?? entry.api_base_url ?? '').replace(/\/+$/, '');
  if (!isHttpsUrl(baseUrl)) return null;
  return { id: override?.id ?? entry.slug, name: entry.name, baseUrl };
}

function printChanges(previous, next) {
  const before = new Map(previous.map(p => [p.id, p]));
  const after = new Map(next.map(p => [p.id, p]));
  for (const p of next) {
    const old = before.get(p.id);
    if (!old) console.log(`  + ${p.id}  ${p.baseUrl}`);
    else if (old.baseUrl !== p.baseUrl) console.log(`  ~ ${p.id}  ${old.baseUrl} -> ${p.baseUrl}`);
    else if (old.name !== p.name) console.log(`  ~ ${p.id}  name: ${old.name} -> ${p.name}`);
  }
  for (const p of previous) {
    if (!after.has(p.id)) console.log(`  - ${p.id}  ${p.baseUrl}`);
  }
}

const res = await fetch(SOURCE_URL);
if (!res.ok) {
  console.error(`[providers:update] Failed to fetch ${SOURCE_URL}: HTTP ${res.status}`);
  process.exit(1);
}
const source = await res.json();
const entries = Array.isArray(source) ? source : source.providers ?? [];

const seen = new Set();
const providers = [];
for (const entry of entries) {
  const provider = toProvider(entry);
  if (!provider || seen.has(provider.id)) continue; // first match wins (upstream order)
  seen.add(provider.id);
  providers.push(provider);
}
providers.sort((a, b) => a.name.localeCompare(b.name));

const previous = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf-8')).providers : [];
if (JSON.stringify(previous) === JSON.stringify(providers)) {
  console.log(`[providers:update] ${providers.length} providers, unchanged.`);
} else {
  printChanges(previous, providers);
  writeFileSync(outPath, JSON.stringify({ source: SOURCE_REPO, providers }, null, 2) + '\n');
  console.log(`[providers:update] Wrote ${providers.length} providers to ${outPath}. Review the baseUrl changes above before committing.`);
}
