import { Plugin } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { detectScript } from '../i18n/language-detect'
import type { Node as PmNode } from 'prosemirror-model'
import type { EditorState } from 'prosemirror-state'

/**
 * ProseMirror plugin that applies language-specific CSS classes to block nodes
 * based on detected or specified language (from metadata or inline tags)
 */
export function createLanguageClassPlugin() {
  return new Plugin({
    state: {
      init(config, state) {
        // Initialize decorations for the initial document
        return computeDecorations(state.doc)
      },
      apply(tr, set, oldState, newState) {
        // If document changed, recompute decorations
        if (tr.docChanged) {
          return computeDecorations(newState.doc)
        }
        // Otherwise, return the existing decoration set
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

/**
 * Compute language decorations for the entire document
 */
function computeDecorations(doc: PmNode): DecorationSet {
  const decorations: Decoration[] = []

  // Iterate through all block nodes and assign language class
  doc.forEach((node, offset) => {
    if (node.isBlock && node.type.name !== 'doc') {
      const lang = resolveBlockLanguage(node)
      const className = `cs-lang-${lang}`

      // Create a decoration (class marker) for this block
      // Pass class in both attrs (for DOM rendering) and spec (for testing/reference)
      const deco = Decoration.node(
        offset,
        offset + node.nodeSize,
        {
          class: className,
        },
        {
          class: className,
        }
      )
      decorations.push(deco)
    }
  })

  return DecorationSet.create(doc, decorations)
}

/**
 * Resolve the language for a single block node
 * Checks: node metadata → detected script → fallback to 'en'
 */
function resolveBlockLanguage(node: PmNode): string {
  // Check for metadata lang attribute (e.g., lang: hi)
  if (node.attrs?.lang) {
    return node.attrs.lang as string
  }

  // Check for inline {lang=…} tag in the node's text
  if (node.textContent) {
    const inlineMatch = /\{lang=([a-z]{2})\}/.exec(node.textContent)
    if (inlineMatch?.[1]) {
      return inlineMatch[1]
    }
  }

  // Detect from text content
  if (node.textContent) {
    return detectScript(node.textContent)
  }

  // Fallback to English
  return 'en'
}
