import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { PmMatch } from '../findreplace/scroll-to-match'

const findHighlightKey = new PluginKey<DecorationSet>('findHighlight')

// Module-level state pushed from FindReplace; the plugin reads this on each update.
let currentMatches: PmMatch[] = []
let currentIndex = 0
let pluginView: import('prosemirror-view').EditorView | null = null

/** Called by FindReplace whenever matches or active index change. */
export function setFindHighlights(matches: PmMatch[], activeIndex: number): void {
  currentMatches = matches
  currentIndex = activeIndex
  if (pluginView) {
    // Dispatch a no-op meta transaction to trigger decoration recompute.
    const tr = pluginView.state.tr.setMeta(findHighlightKey, true)
    pluginView.dispatch(tr)
  }
}

/** Called by FindReplace when the panel closes — clears all highlights. */
export function clearFindHighlights(): void {
  setFindHighlights([], 0)
}

function buildDecorations(matches: PmMatch[], activeIndex: number, doc: import('prosemirror-model').Node): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty
  const decos = matches.map((m, i) =>
    Decoration.inline(m.pmFrom, m.pmTo, {
      class: i === activeIndex ? 'cs-find-active' : 'cs-find-match',
    })
  )
  return DecorationSet.create(doc, decos)
}

export function createFindHighlightPlugin(): Plugin {
  return new Plugin<DecorationSet>({
    key: findHighlightKey,

    view(view) {
      pluginView = view
      return {
        destroy() { pluginView = null },
      }
    },

    state: {
      init(_config, state) {
        return buildDecorations(currentMatches, currentIndex, state.doc)
      },
      apply(tr, _old, _oldState, newState) {
        // Recompute on doc change (positions shift) or when we push a meta update.
        if (tr.docChanged || tr.getMeta(findHighlightKey)) {
          return buildDecorations(currentMatches, currentIndex, newState.doc)
        }
        return _old
      },
    },

    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })
}
