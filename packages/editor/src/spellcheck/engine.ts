import { getModuleLoader, mountBuffer } from 'emscripten-wasm-loader'
// hunspell-asm's own loader goes through namespace imports (`import * as nanoid`, ...) that
// bundlers and ES modules reject, so this takes its WebAssembly runtime directly and does
// the little it needs: mount the files, create a Hunspell, ask `spell`.
import runtime from 'hunspell-asm/dist/esm/lib/browser/hunspell.js'

export interface DictionaryFiles { aff: Uint8Array; dic: Uint8Array }

interface Asm {
  cwrap: (name: string, ret: string | null, args: string[]) => (...a: number[]) => number
  FS: unknown
  allocateUTF8: (s: string) => number
  _free: (ptr: number) => void
  _malloc: (size: number) => number
  getValue: (ptr: number, type: string) => number
  UTF8ToString: (ptr: number) => string
}

interface Loaded {
  asm: Asm
  mount: (files: Uint8Array, name: string) => string
  create: (aff: number, dic: number) => number
  spell: (handle: number, word: number) => number
  suggest: (handle: number, listPtr: number, word: number) => number
  freeList: (handle: number, listPtr: number, count: number) => void
}

const MOUNT_DIR = '/spellcheck'

async function boot(): Promise<Loaded> {
  const load = getModuleLoader<Loaded>(rt => {
    const asm = rt as Asm
    ;(asm.FS as { mkdir: (p: string) => void }).mkdir(MOUNT_DIR)
    return {
      asm,
      mount: mountBuffer(asm.FS, MOUNT_DIR),
      create: asm.cwrap('Hunspell_create', 'number', ['number', 'number']),
      spell: asm.cwrap('Hunspell_spell', 'number', ['number', 'number']),
      suggest: asm.cwrap('Hunspell_suggest', 'number', ['number', 'number', 'number']),
      freeList: asm.cwrap('Hunspell_free_list', null, ['number', 'number', 'number']) as Loaded['freeList'],
    }
  }, runtime, undefined, {})
  return load()
}

/** Hunspell (WebAssembly) dictionaries held in memory, one per language. Checking a word is a native call, so it runs on the main thread. */
export class SpellEngine {
  private loaded: Promise<Loaded> | null = null
  private handles = new Map<string, number>()

  /** Loads a language's dictionary once; later calls with the same code are no-ops. */
  async load(code: string, files: () => Promise<DictionaryFiles>): Promise<void> {
    if (this.handles.has(code)) return
    this.loaded ??= boot()
    const hs = await this.loaded
    const { aff, dic } = await files()
    if (this.handles.has(code)) return
    const affPath = hs.mount(aff, `${code}.aff`)
    const dicPath = hs.mount(dic, `${code}.dic`)
    const a = hs.asm.allocateUTF8(affPath)
    const d = hs.asm.allocateUTF8(dicPath)
    this.handles.set(code, hs.create(a, d))
    hs.asm._free(a)
    hs.asm._free(d)
  }

  /** The words the language's dictionary does not accept. */
  async misspelled(code: string, words: string[]): Promise<string[]> {
    const handle = this.handles.get(code)
    if (handle === undefined) return []
    const hs = await this.loaded!
    return words.filter(w => {
      const ptr = hs.asm.allocateUTF8(w.normalize())
      try { return hs.spell(handle, ptr) === 0 } finally { hs.asm._free(ptr) }
    })
  }

  /** Hunspell's replacements for a word, best first. */
  async suggest(code: string, word: string, limit = 5): Promise<string[]> {
    const handle = this.handles.get(code)
    if (handle === undefined) return []
    const hs = await this.loaded!
    const { asm } = hs
    const wordPtr = asm.allocateUTF8(word.normalize())
    const listPtr = asm._malloc(4)
    try {
      const count = hs.suggest(handle, listPtr, wordPtr)
      const list = asm.getValue(listPtr, '*')
      const out: string[] = []
      for (let i = 0; i < Math.min(count, limit); i++) out.push(asm.UTF8ToString(asm.getValue(list + i * 4, '*')))
      if (count > 0) hs.freeList(handle, listPtr, count)
      return out
    } finally {
      asm._free(wordPtr)
      asm._free(listPtr)
    }
  }
}
