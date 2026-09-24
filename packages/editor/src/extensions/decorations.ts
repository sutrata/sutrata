import { createContext, useContext } from 'react'
import type { DocumentNode } from '@sutrata/parser'

/**
 * Where a decoration sits. Anchors are scene-relative so they survive edits
 * elsewhere in the document: `sceneId` is the scene's `{#id}` (scenes
 * without one cannot be anchored — the navigator flags them), and
 * `from`/`to` are character offsets into that scene's text as returned by
 * `ctx.sceneText(sceneId)`.
 *
 * Scene text is the scene's blocks (heading through the last block before
 * the next heading) joined with '\n', with line breaks as '\n'.
 */
export interface Anchor {
  sceneId: string
  from?: number
  to?: number
}

export type DecorationSpec =
  | {
      /** `inline`: a text range (default: the whole scene). `node`: the block containing `from` (default: the heading). */
      kind: 'inline' | 'node'
      anchor: Anchor
      className?: string
      attrs?: Record<string, string>
      /** Called on click, including in read-only and comment sessions. */
      onClick?(e: MouseEvent): void
    }
  | {
      /** A DOM element inserted at `anchor.from` (default: the start of the scene). */
      kind: 'widget'
      anchor: Anchor
      side?: -1 | 1
      render(): HTMLElement
    }

export interface DecorationContext {
  ast: DocumentNode
  /** The anchorable text of a scene, or null if no scene has that id. */
  sceneText(sceneId: string): string | null
}

/**
 * External annotations — comment threads, breakdown highlights, revision
 * marks — rendered in the formatted editor (OSS spec §11.5).
 * `subscribe` tells the editor to call `getDecorations` again.
 */
export interface DecorationProvider {
  id: string
  subscribe(onChange: () => void): () => void
  getDecorations(ctx: DecorationContext): DecorationSpec[]
}

const DecorationProvidersContext = createContext<readonly DecorationProvider[]>([])

export const DecorationProvidersProvider = DecorationProvidersContext.Provider

export function useDecorationProviders(): readonly DecorationProvider[] {
  return useContext(DecorationProvidersContext)
}
