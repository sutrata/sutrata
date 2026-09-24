import { createContext, useContext } from 'react'
import type { Schema } from 'prosemirror-model'
import type { Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

/**
 * Binds the formatted editor to a real-time sync provider (e.g. a Yjs
 * document via y-prosemirror) (OSS spec §11.5).
 *
 * `plugins` are added whenever the editor creates its state; `attach` is
 * called once the view exists and returns a detach function, called when
 * the view is destroyed.
 *
 * The editor serializes the shared ProseMirror document back to Sutra text
 * with the AST-lossless serializer (packages/editor/tests/lossless-round-trip.test.ts),
 * so collaborators see the same document the file contains.
 */
export interface CollabBinding {
  plugins(schema: Schema): Plugin[]
  attach(view: EditorView): () => void
}

const CollabBindingContext = createContext<CollabBinding | null>(null)

export const CollabBindingProvider = CollabBindingContext.Provider

export function useCollabBinding(): CollabBinding | null {
  return useContext(CollabBindingContext)
}
