import { Plugin } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node as PmNode } from 'prosemirror-model'
import type { EditorState } from 'prosemirror-state'

/**
 * ProseMirror plugin that styles a character cue's trailing extension
 * "(V.O.)"/"(O.S.)" and dual-dialogue "^" marker live, purely from the text
 * pattern — there's no dedicated UI to set these; per the format spec, any
 * content in parentheses at the end of a character line is an extension,
 * and a trailing "^" marks dual dialogue. No node attrs or persisted marks
 * are involved — decorations are recomputed from scratch on every doc
 * change, the same way createLanguageClassPlugin() does for script classes.
 */
export function createCharacterDecorationPlugin() {
  return new Plugin({
    state: {
      init(_config, state) {
        return computeDecorations(state.doc)
      },
      apply(tr, set, _oldState, newState) {
        if (tr.docChanged) {
          return computeDecorations(newState.doc)
        }
        return set
      },
    },
    props: {
      decorations(state: EditorState) {
        return this.getState(state)
      },
    },
  })
}

interface DecorationRanges {
  parenStart?: number
  parenEnd?: number
  dualStart?: number
  dualEnd?: number
}

/**
 * Finds the trailing "(...)"-group span and/or trailing "^" span in a
 * character cue's text, as character offsets into `text`. Either, both, or
 * neither may be present. The "^" is checked (and stripped from
 * consideration) first, since it comes after any extension groups.
 */
export function findCharacterDecorationRanges(text: string): DecorationRanges {
  const ranges: DecorationRanges = {}

  let working = text
  const dualMatch = /\s(\^)\s*$/.exec(text)
  if (dualMatch) {
    ranges.dualStart = dualMatch.index + dualMatch[0].indexOf('^')
    ranges.dualEnd = ranges.dualStart + 1
    working = text.slice(0, dualMatch.index)
  }

  const parenMatch = /(\s+\([^()]*\))+\s*$/.exec(working)
  if (parenMatch) {
    const matched = parenMatch[0]
    const leadingWs = matched.length - matched.trimStart().length
    ranges.parenStart = parenMatch.index + leadingWs
    ranges.parenEnd = parenMatch.index + matched.trimEnd().length
  }

  return ranges
}

function computeDecorations(doc: PmNode): DecorationSet {
  const decorations: Decoration[] = []

  doc.forEach((node, pos) => {
    if (node.type.name !== 'character') return
    const text = node.textContent
    if (!text) return

    const { parenStart, parenEnd, dualStart, dualEnd } = findCharacterDecorationRanges(text)
    // +1: text content starts one position inside the block node
    const contentStart = pos + 1

    if (parenStart !== undefined && parenEnd !== undefined) {
      // class passed in both attrs (DOM rendering) and spec (testing/reference) —
      // matches language-class-plugin.ts's convention.
      decorations.push(Decoration.inline(
        contentStart + parenStart,
        contentStart + parenEnd,
        { class: 'cs-character-extension' },
        { class: 'cs-character-extension' }
      ))
    }
    if (dualStart !== undefined && dualEnd !== undefined) {
      decorations.push(Decoration.inline(
        contentStart + dualStart,
        contentStart + dualEnd,
        { class: 'cs-character-dual-marker' },
        { class: 'cs-character-dual-marker' }
      ))
    }
  })

  return DecorationSet.create(doc, decorations)
}
