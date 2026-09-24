import { createContext, useContext, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { DocumentNode } from '@sutrata/parser'

export type PanelLocation = 'settings'

export interface PanelRenderContext {
  ast: DocumentNode
}

/** A section contributed by the embedder. */
export interface PanelContribution {
  id: string
  title: string
  location: PanelLocation
  render(ctx: PanelRenderContext): ReactNode
}

/**
 * Embedder-contributed panels (OSS spec §11.5). `register` returns an
 * unregister function; registrations can change at runtime.
 */
export interface PanelRegistry {
  register(panel: PanelContribution): () => void
  list(location: PanelLocation): PanelContribution[]
  subscribe(listener: () => void): () => void
}

export function createPanelRegistry(initial: PanelContribution[] = []): PanelRegistry {
  let panels = [...initial]
  const listeners = new Set<() => void>()
  const notify = () => { for (const l of listeners) l() }
  const cache = new Map<PanelLocation, PanelContribution[]>()
  return {
    register(panel) {
      panels = [...panels.filter(p => p.id !== panel.id), panel]
      cache.clear()
      notify()
      return () => {
        panels = panels.filter(p => p !== panel)
        cache.clear()
        notify()
      }
    },
    list(location) {
      // Stable array identity between changes, for useSyncExternalStore.
      let list = cache.get(location)
      if (!list) {
        list = panels.filter(p => p.location === location)
        cache.set(location, list)
      }
      return list
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

const EMPTY_REGISTRY = createPanelRegistry()
const PanelRegistryContext = createContext<PanelRegistry>(EMPTY_REGISTRY)

export const PanelRegistryProvider = PanelRegistryContext.Provider

export function usePanelRegistry(): PanelRegistry {
  return useContext(PanelRegistryContext)
}

/** Panels registered for `location`, re-rendering when registrations change. */
export function usePanels(location: PanelLocation): PanelContribution[] {
  const registry = usePanelRegistry()
  return useSyncExternalStore(registry.subscribe, () => registry.list(location), () => registry.list(location))
}
