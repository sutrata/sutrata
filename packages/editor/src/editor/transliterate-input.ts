import { Plugin } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { transliterate, Script } from '@sutra/parser'

// Map BCP-47 codes to Script names used by the transliterate engine
const LANG_TO_SCRIPT: Record<string, Script> = {
  'hi': 'devanagari',
  'mr': 'devanagari',
  'sa': 'devanagari',
  'ta': 'tamil',
  'te': 'telugu',
  'kn': 'kannada',
  'ml': 'malayalam',
  'bn': 'bengali',
  'gu': 'gujarati',
  'pa': 'gurmukhi',
  'or': 'odia',
}

// Word boundary characters — trigger transliteration
const WORD_BOUNDARIES = new Set([' ', '\t', '\n', '.', ',', '?', '!', ':', ';', '-', '(', ')'])

interface TranslitState {
  enabled: boolean
  buffer: string
  currentLang: string
}

const globalState: TranslitState = {
  enabled: false,
  buffer: '',
  currentLang: 'hi',
}

/** Enable or disable transliteration mode. */
export function setTranslitMode(enabled: boolean, lang: string = 'hi') {
  globalState.enabled = enabled
  globalState.currentLang = lang
  globalState.buffer = ''
}

/** Returns whether transliteration mode is active. */
export function isTranslitMode(): boolean {
  return globalState.enabled
}

/**
 * ProseMirror plugin that intercepts text input and converts roman keystrokes
 * to native script on word boundaries.
 */
export function createTranslitPlugin() {
  return new Plugin({
    props: {
      handleTextInput(view: EditorView, _from: number, _to: number, text: string): boolean {
        if (!globalState.enabled) return false

        const script = LANG_TO_SCRIPT[globalState.currentLang]
        if (!script) return false

        if (WORD_BOUNDARIES.has(text)) {
          // Flush buffer: transliterate and replace
          if (globalState.buffer.length > 0) {
            const native = transliterate(globalState.buffer, script)
            const { state, dispatch } = view
            const { from } = state.selection

            // Replace the buffered roman text with native script + boundary char
            const bufferStart = from - globalState.buffer.length
            const tr = state.tr
              .replaceWith(
                bufferStart,
                from,
                state.schema.text(native + text)
              )
            globalState.buffer = ''
            dispatch(tr)
            return true
          }
          // Nothing buffered, let boundary char through
          return false
        } else {
          // Accumulate roman keystrokes in buffer
          globalState.buffer += text
          // Let ProseMirror insert the roman char temporarily (user sees buffering)
          return false
        }
      },

      handleKeyDown(_view: EditorView, event: KeyboardEvent): boolean {
        if (!globalState.enabled) return false

        // Backspace: remove from buffer too
        if (event.key === 'Backspace' && globalState.buffer.length > 0) {
          globalState.buffer = globalState.buffer.slice(0, -1)
          return false // let PM handle the actual deletion
        }

        // Escape: clear buffer without inserting
        if (event.key === 'Escape') {
          globalState.buffer = ''
          return false
        }

        return false
      },
    },
  })
}
