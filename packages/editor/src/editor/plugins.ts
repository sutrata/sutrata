import { history } from 'prosemirror-history'
import { baseKeymap } from 'prosemirror-commands'
import { keymap } from 'prosemirror-keymap'
import { buildKeymap } from './keymap'
import { createLanguageClassPlugin } from './language-class-plugin'
import { createCharacterDecorationPlugin } from './character-decoration-plugin'
import { createImePluginWithRef } from './ime-plugin'
import { createAutocompletePlugin } from '../autocomplete/AutocompletePlugin'
import { createSpellcheckPlugin } from '../spellcheck/spellcheck-plugin'
import { createAttrPencilPlugin } from './attr-pencil-plugin'
import { createFindHighlightPlugin } from './find-highlight-plugin'

export function buildPlugins() {
  return [
    history(),
    buildKeymap(),
    keymap(baseKeymap),
    createLanguageClassPlugin(),
    createCharacterDecorationPlugin(),
    createImePluginWithRef(),
    createAutocompletePlugin(),
    createSpellcheckPlugin(),
    createAttrPencilPlugin(),
    createFindHighlightPlugin(),
  ]
}
