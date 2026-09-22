import { Plugin } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'

// Character-cue autocomplete was disabled: the dropdown interrupted typing
// more than it helped. This plugin is kept as a no-op registration point
// in case popup-based suggestions are revisited for other cue types.
export function createAutocompletePlugin() {
  return new Plugin({
    view(_editorView: EditorView) {
      return {
        update(_view: EditorView) {},
        destroy() {},
      }
    },
    props: {
      handleKeyDown(_view: EditorView, _event: KeyboardEvent): boolean {
        return false
      },
    },
  })
}
