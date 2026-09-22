// Generates src/ai/generated-providers.json (and a copy at
// packages/app/public/models-config.json) from the community-maintained
// all-llm-provider-list registry, at build time.
//
// Only providers Sutrata can actually drive are kept: ones with a real
// env_variable (i.e. a "paste an API key" auth model — this drops
// OAuth/browser-cookie/local-only/no-auth entries) and either
// openai_compatible: true, or Anthropic (the one vendor ai-client.ts still
// calls via a bespoke request shape, since Anthropic has no OpenAI-compat
// endpoint). Google/Gemini is retargeted at its official OpenAI-compat base
// URL (https://generativelanguage.googleapis.com/v1beta/openai) so it flows
// through the generic branch too, rather than needing its own adapter.
//
// TODO(future): this list is currently refreshed only when this script is
// re-run at build time. A follow-up could instead fetch the upstream list
// live each time the user opens the AI settings/onboarding dialog, so the
// provider catalog stays current without a rebuild — intentionally not done
// here to keep this change scoped.

import { writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const editorOutPath = join(root, 'src/ai/generated-providers.json');
const appOutPath = join(root, '../app/public/models-config.json');

const SOURCE_URL = 'https://raw.githubusercontent.com/foisalislambd/all-llm-provider-list/main/data/providers.json';

// id/baseUrl overrides for vendors Sutrata treats specially. Ids double as
// localStorage key suffixes (sutrata_api_key_<id>) and, for anthropic, as
// invokeProvider's branch discriminator — they must stay stable across
// regenerations regardless of what the upstream slug says.
//
// `models` overrides are needed because the upstream list's popular_models
// sometimes holds human-readable display names (e.g. "Claude Opus 4.8")
// rather than API-ready model ids — fine for a dropdown label, but wrong if
// sent verbatim as the `model` field. These two are the ids actually used
// for testConnection() before listModels() has a chance to fetch live ones;
// everyone else relies on listModels() to correct a bad static id at
// first use.
const OVERRIDES = {
  anthropic: {
    id: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-opus-5', name: 'Claude Opus 5' },
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
  'google-ai-studio': {
    id: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
    ],
  },
};
OVERRIDES.gemini = OVERRIDES['google-ai-studio'];
OVERRIDES.google = OVERRIDES['google-ai-studio'];

const ESSENTIAL_IDS = new Set(['anthropic', 'gemini', 'groq']);

function isSupported(entry) {
  if (!entry.env_variable || !entry.api_base_url) return false;
  const override = OVERRIDES[entry.slug];
  return entry.openai_compatible === true || override?.id === 'anthropic';
}

function toProviderConfig(entry) {
  const override = OVERRIDES[entry.slug];
  const id = override?.id ?? entry.slug;
  const baseUrl = override?.baseUrl ?? entry.api_base_url;
  const config = {
    id,
    name: entry.name,
    baseUrl,
    models: override?.models ?? (entry.popular_models ?? []).map((m) => ({ id: m, name: m })),
  };
  if (ESSENTIAL_IDS.has(id)) config.essential = true;
  return config;
}

async function main() {
  let source;
  try {
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    source = await res.json();
  } catch (e) {
    console.warn(`[generate-providers] Failed to fetch ${SOURCE_URL}: ${e}. Leaving existing generated files untouched.`);
    if (!existsSync(editorOutPath)) {
      console.error('[generate-providers] No existing generated-providers.json to fall back to — build will use the compiled-in defaults only.');
    }
    return;
  }

  const entries = Array.isArray(source) ? source : source.providers ?? [];
  const seen = new Set();
  const providers = [];
  for (const entry of entries) {
    if (!isSupported(entry)) continue;
    const config = toProviderConfig(entry);
    if (seen.has(config.id)) continue; // first match wins (upstream list order)
    seen.add(config.id);
    providers.push(config);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'https://github.com/foisalislambd/all-llm-provider-list',
    providers,
  };

  const json = JSON.stringify(output, null, 2) + '\n';
  writeFileSync(editorOutPath, json);

  const appConfig = { providers: output.providers };
  writeFileSync(appOutPath, JSON.stringify(appConfig, null, 2) + '\n');

  console.log(`[generate-providers] Wrote ${providers.length} providers to ${editorOutPath} and ${appOutPath}.`);
}

await main();
