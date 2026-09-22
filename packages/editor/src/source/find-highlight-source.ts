import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'
import { getSourceView } from '../editor/editor-bus'

export interface SourceMatch {
  start: number
  end: number
}

const setMatchesEffect = StateEffect.define<{ matches: SourceMatch[]; activeIndex: number }>()

function buildDecorations(matches: SourceMatch[], activeIndex: number, docLength: number): DecorationSet {
  if (matches.length === 0) return Decoration.none
  const decos = matches
    .filter(m => m.start >= 0 && m.end <= docLength && m.start < m.end)
    .map((m, i) => Decoration.mark({ class: i === activeIndex ? 'cs-find-active' : 'cs-find-match' }).range(m.start, m.end))
  return Decoration.set(decos, true)
}

const findHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const effect of tr.effects) {
      if (effect.is(setMatchesEffect)) {
        deco = buildDecorations(effect.value.matches, effect.value.activeIndex, tr.state.doc.length)
      }
    }
    return deco
  },
  provide: field => EditorView.decorations.from(field),
})

/** CodeMirror extension providing find-match highlighting in source view. */
export const sourceFindHighlightExtension = findHighlightField

/** Called by FindReplace whenever matches or active index change in source mode. */
export function setSourceFindHighlights(matches: SourceMatch[], activeIndex: number): void {
  const view = getSourceView()
  if (!view) return
  view.dispatch({ effects: setMatchesEffect.of({ matches, activeIndex }) })
}

/** Called by FindReplace when the panel closes — clears all source-view highlights. */
export function clearSourceFindHighlights(): void {
  setSourceFindHighlights([], 0)
}

/** Scroll the source view so the given match is visible. */
export function scrollToSourceMatch(match: SourceMatch): void {
  const view = getSourceView()
  if (!view) return
  view.dispatch({ effects: EditorView.scrollIntoView(match.start, { y: 'center' }) })
}
