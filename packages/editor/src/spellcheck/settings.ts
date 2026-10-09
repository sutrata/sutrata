import { useSyncExternalStore } from 'react'

export type DictionaryState = 'loading' | 'ready' | 'unavailable'

export interface SpellcheckSettings {
  enabled: boolean
  /** Code of the regional language checked alongside English, or '' for English only. */
  regional: string
  /** Words the writer chose to ignore (lowercase), kept in this browser. */
  ignored: string[]
}

export interface SpellcheckSnapshot extends SpellcheckSettings {
  dictionaries: Readonly<Record<string, DictionaryState>>
}

const STORAGE_KEY = 'cs-spellcheck'
const listeners = new Set<() => void>()

let dictionaryBase = '/dict/'

/** Where the dictionary files are served from. Default `/dict/`. */
export function configureSpellcheck(options: { dictionaryBaseUrl?: string }) {
  if (options.dictionaryBaseUrl) dictionaryBase = options.dictionaryBaseUrl.replace(/\/?$/, '/')
}
export const dictionaryBaseUrl = () => dictionaryBase

function load(): SpellcheckSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return {
      enabled: raw.enabled === true,
      regional: typeof raw.regional === 'string' ? raw.regional : '',
      ignored: Array.isArray(raw.ignored) ? raw.ignored.filter((w: unknown) => typeof w === 'string') : [],
    }
  } catch {
    return { enabled: false, regional: '', ignored: [] }
  }
}

let snapshot: SpellcheckSnapshot = { ...load(), dictionaries: {} }

function publish(next: SpellcheckSnapshot) {
  snapshot = next
  listeners.forEach(l => l())
}

export function getSpellcheck(): SpellcheckSnapshot { return snapshot }

export function updateSpellcheck(change: Partial<SpellcheckSettings>) {
  const { dictionaries, ...settings } = { ...snapshot, ...change }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* unsaved preference */ }
  publish({ ...settings, dictionaries })
}

export function ignoreWord(word: string) {
  const w = word.toLowerCase()
  if (!snapshot.ignored.includes(w)) updateSpellcheck({ ignored: [...snapshot.ignored, w] })
}

export function unignoreWord(word: string) {
  updateSpellcheck({ ignored: snapshot.ignored.filter(w => w !== word) })
}

export function setDictionaryState(code: string, state: DictionaryState) {
  if (snapshot.dictionaries[code] === state) return
  publish({ ...snapshot, dictionaries: { ...snapshot.dictionaries, [code]: state } })
}

export function subscribeSpellcheck(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function useSpellcheck(): SpellcheckSnapshot {
  return useSyncExternalStore(subscribeSpellcheck, getSpellcheck, getSpellcheck)
}
