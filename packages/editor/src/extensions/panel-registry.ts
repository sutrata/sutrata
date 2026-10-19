import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { DocumentNode } from '@sutrata/parser'
import { createRegistryStore, useRegistryList } from './registry-store'
import type { RegistryStore } from './registry-store'

/**
 * - `sidebar`: tabs beside the scene navigator (the built-in first tab).
 * - `inspector`: sections in a panel on the right of the editor.
 * - `appbar`: small items in the app bar, before Settings.
 * - `settings`: sections in the Settings dialog.
 */
export type PanelLocation = 'sidebar' | 'inspector' | 'appbar' | 'settings'

export interface PanelRenderContext {
  ast: DocumentNode
  /** Ids of scenes that have one, in document order. */
  sceneIds: string[]
  /** Id of the scene containing the caret, if it has one. */
  activeSceneId: string | null
  /** Position of the scene containing the caret among all scene headings, from 0 (numbered or not). */
  activeSceneIndex: number | null
  /** True while the caret is in the title page (the front matter), not in a scene. */
  inTitlePage: boolean
}

/** A panel contributed by the embedder (OSS spec §11.5). */
export interface PanelContribution {
  id: string
  title: string
  location: PanelLocation
  /**
   * A `sidebar` tab's icon (16px, `currentColor`). With one, the tab shows only the icon until it is selected, then the icon and
   * `title`; `title` is its tooltip and accessible name. Without one the tab is its title, as before. Icons keep a row of tabs
   * short in every language.
   */
  icon?: ReactNode
  /** True if the panel shows the title page form: the title page dialog then stays closed. */
  handlesTitlePage?: boolean
  render(ctx: PanelRenderContext): ReactNode
}

export type PanelRegistry = RegistryStore<PanelContribution>

export function createPanelRegistry(initial: PanelContribution[] = []): PanelRegistry {
  return createRegistryStore(initial)
}

const EMPTY_REGISTRY = createPanelRegistry()
const PanelRegistryContext = createContext<PanelRegistry>(EMPTY_REGISTRY)

export const PanelRegistryProvider = PanelRegistryContext.Provider

export function usePanelRegistry(): PanelRegistry {
  return useContext(PanelRegistryContext)
}

/** Registered panels for `location`, re-rendering when registrations change. */
export function usePanels(location: PanelLocation): PanelContribution[] {
  const all = useRegistryList(usePanelRegistry())
  return useMemo(() => all.filter(p => p.location === location), [all, location])
}
