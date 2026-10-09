import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorState } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { languageByCode, languageForWord } from './languages'
import type { SpellLanguage } from './languages'
import { isShouted, normalizeWord, tokenizeWords } from './tokenize'
import { misspelledWords, suggestionsFor } from './client'
import { dictionaryBaseUrl, getSpellcheck, ignoreWord, setDictionaryState, subscribeSpellcheck } from './settings'
import { showSpellMenu } from './spell-menu'

export { tokenizeWords } from './tokenize'

/** Blocks whose text is prose; names, headings and transitions are not checked. */
const CHECKED = new Set(['action', 'dialogue', 'parenthetical', 'lyrics', 'centered'])
const DEBOUNCE_MS = 300

export const spellcheckKey = new PluginKey<DecorationSet>('spellcheck')

/** language code → word → whether the dictionary rejects it. */
const verdicts = new Map<string, Map<string, boolean>>()
const failed = new Set<string>()

function activeLanguages(): { regional: SpellLanguage | undefined } {
  return { regional: getSpellcheck().regional ? languageByCode(getSpellcheck().regional) : undefined }
}

interface Found { from: number; to: number; code: string; word: string }

function findWords(state: EditorState): Found[] {
  const { regional } = activeLanguages()
  const found: Found[] = []
  state.doc.forEach((node, offset) => {
    if (!CHECKED.has(node.type.name) || node.content.size === 0) return
    // Inline leaves (line breaks) count as one character, as they do in positions.
    const text = node.textBetween(0, node.content.size, undefined, '\n')
    for (const token of tokenizeWords(text)) {
      if (token.word.length < 2 || isShouted(token.word)) continue
      const code = languageForWord(token.word, regional)
      if (code) found.push({ from: offset + 1 + token.start, to: offset + 1 + token.end, code, word: normalizeWord(token.word) })
    }
  })
  return found
}

/**
 * The words of the script's character names, lowercase. Worked out from the
 * document each time, so a name stops being ignored once no character has it.
 */
function characterWords(state: EditorState): Set<string> {
  const words = new Set<string>()
  state.doc.forEach(node => {
    if (node.type.name !== 'character') return
    for (const t of tokenizeWords(node.textContent)) words.add(normalizeWord(t.word).toLowerCase())
  })
  return words
}

function decorate(state: EditorState): DecorationSet {
  if (!getSpellcheck().enabled) return DecorationSet.empty
  const skip = characterWords(state)
  for (const w of getSpellcheck().ignored) skip.add(w)
  const decorations = findWords(state)
    .filter(f => verdicts.get(f.code)?.get(f.word) === true && !skip.has(f.word.toLowerCase()))
    .map(f => Decoration.inline(f.from, f.to, { class: 'cs-spell-error' }, { code: f.code, word: f.word }))
  return DecorationSet.create(state.doc, decorations)
}

/**
 * Underlines misspelled words, in English and the chosen regional language.
 * Words are checked in a worker; the underlines appear when it answers.
 */
export function createSpellcheckPlugin() {
  return new Plugin<DecorationSet>({
    key: spellcheckKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set, _old, newState) {
        if (tr.getMeta(spellcheckKey) === 'refresh') return decorate(newState)
        return tr.docChanged ? set.map(tr.mapping, tr.doc) : set
      },
    },
    props: {
      decorations(state) { return spellcheckKey.getState(state) },
      handleDOMEvents: {
        contextmenu(view, event) {
          const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
          if (!at) return false
          const hit = spellcheckKey.getState(view.state)?.find(at.pos, at.pos).find(d => d.from <= at.pos && at.pos <= d.to)
          if (!hit) return false
          const { code, word } = hit.spec as { code: string; word: string }
          event.preventDefault()
          const { from, to } = hit
          void suggestionsFor(code, word).catch(() => [] as string[]).then(suggestions => {
            showSpellMenu({
              x: event.clientX, y: event.clientY, word, suggestions, canEdit: view.editable,
              onReplace: replacement => {
                view.dispatch(view.state.tr.insertText(replacement, from, to))
                view.focus()
              },
              onIgnore: () => { ignoreWord(word); view.focus() },
            })
          })
          return true
        },
      },
    },
    view(view) {
      let timer: ReturnType<typeof setTimeout> | undefined
      let destroyed = false

      const run = async () => {
        const settings = getSpellcheck()
        if (settings.enabled) {
          const wanted = new Map<string, Set<string>>()
          for (const f of findWords(view.state)) {
            if (verdicts.get(f.code)?.has(f.word) || failed.has(f.code)) continue
            if (!wanted.has(f.code)) wanted.set(f.code, new Set())
            wanted.get(f.code)!.add(f.word)
          }
          await Promise.all([...wanted].map(async ([code, words]) => {
            const lang = languageByCode(code)!
            if (!getSpellcheck().dictionaries[code]) setDictionaryState(code, 'loading')
            try {
              const bad = new Set(await misspelledWords(code, lang.file, dictionaryBaseUrl(), [...words]))
              const known = verdicts.get(code) ?? new Map<string, boolean>()
              for (const w of words) known.set(w, bad.has(w))
              verdicts.set(code, known)
              setDictionaryState(code, 'ready')
            } catch {
              failed.add(code)
              setDictionaryState(code, 'unavailable')
            }
          }))
        }
        if (!destroyed) view.dispatch(view.state.tr.setMeta(spellcheckKey, 'refresh'))
      }

      const schedule = (delay = DEBOUNCE_MS) => {
        clearTimeout(timer)
        timer = setTimeout(() => { void run() }, delay)
      }

      // A different language, switching it on or off, or a changed ignore list re-checks now; a retry clears an earlier failure.
      const signature = () => `${getSpellcheck().enabled}:${getSpellcheck().regional}:${getSpellcheck().ignored.join(',')}`
      let last = signature()
      const unsubscribe = subscribeSpellcheck(() => {
        const now = signature()
        if (now === last) return
        last = now
        failed.clear()
        schedule(0)
      })
      if (getSpellcheck().enabled) schedule(0)

      return {
        update(v, prev) { if (v.state.doc !== prev.doc) schedule() },
        destroy() { destroyed = true; clearTimeout(timer); unsubscribe() },
      }
    },
  })
}

/** Test hook: forget every verdict and failure. */
export function resetSpellcheckCache() {
  verdicts.clear()
  failed.clear()
}
