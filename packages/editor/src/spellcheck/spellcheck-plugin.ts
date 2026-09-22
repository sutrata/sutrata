import { Plugin, EditorState } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { loadDictionary, SpellChecker } from './hunspell'

// Module-level state
let currentChecker: SpellChecker | null = null
let currentLang = 'en'

export function setSpellcheckLanguage(lang: string) {
  if (lang === currentLang) return
  currentLang = lang
  currentChecker = null // force reload
  loadDictionary(lang).then(checker => {
    currentChecker = checker
  })
}

/**
 * Tokenize text into words (splitting on whitespace and punctuation).
 * Returns array of {word, start, end} with character offsets.
 * Uses Unicode letter/mark categories to support Indic scripts.
 */
export function tokenizeWords(text: string): Array<{ word: string; start: number; end: number }> {
  const results: Array<{ word: string; start: number; end: number }> = []
  const regex = /[\p{L}\p{M}'-]+/gu
  let match
  while ((match = regex.exec(text)) !== null) {
    results.push({ word: match[0], start: match.index, end: match.index + match[0].length })
  }
  return results
}

/**
 * ProseMirror plugin that underlines misspelled words via Decoration API.
 * Recomputes decorations on every doc change.
 */
export function createSpellcheckPlugin() {
  return new Plugin({
    state: {
      init() {
        return DecorationSet.empty
      },
      apply(tr, set, _oldState, newState) {
        if (!tr.docChanged) return set
        if (!currentChecker) return DecorationSet.empty

        return computeDecorations(newState, currentChecker)
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })
}

function computeDecorations(state: EditorState, checker: SpellChecker): DecorationSet {
  const decorations: Decoration[] = []

  state.doc.forEach((node, offset) => {
    if (!node.isBlock || !node.textContent) return

    const text = node.textContent
    const tokens = tokenizeWords(text)

    for (const token of tokens) {
      if (!checker.check(token.word)) {
        // Misspelled: add wavy underline decoration
        const from = offset + 1 + token.start
        const to = offset + 1 + token.end
        decorations.push(
          Decoration.inline(from, to, {
            class: 'cs-spell-error',
            title: `"${token.word}" may be misspelled`,
          })
        )
      }
    }
  })

  return DecorationSet.create(state.doc, decorations)
}
