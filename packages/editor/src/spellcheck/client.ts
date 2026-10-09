import { SpellEngine } from './engine'
import type { DictionaryFiles } from './engine'

const engine = new SpellEngine()

async function fetchFile(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  // A single-page app answers a missing file with its index page.
  if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(`Dictionary not found: ${url}`)
  }
  return new Uint8Array(await res.arrayBuffer())
}

const dictionary = (base: string, file: string): Promise<DictionaryFiles> =>
  Promise.all([fetchFile(`${base}${file}.aff`), fetchFile(`${base}${file}.dic`)]).then(([aff, dic]) => ({ aff, dic }))

/** Which of `words` the language's dictionary rejects. Rejects if the dictionary can't be loaded. */
export async function misspelledWords(code: string, file: string, base: string, words: string[]): Promise<string[]> {
  await engine.load(code, () => dictionary(base, file))
  return engine.misspelled(code, words)
}

/** Replacements for a misspelled word. */
export const suggestionsFor = (code: string, word: string): Promise<string[]> => engine.suggest(code, word)
