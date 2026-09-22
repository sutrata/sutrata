import { createContext, useContext } from 'react'
import type { VersionEntry } from '../types'
import type { ScreenplayStyleDefinition } from '../styles/types'

/**
 * Injected by the embedder (OSS spec §11.5). The OSS app supplies a local
 * implementation (IndexedDB + File System Access API, see @sutrata/app's
 * local-storage-adapter.ts); Sutrata Cloud supplies a networked one.
 *
 * `handle` fields are opaque (`unknown`) on purpose: a web FileSystemFileHandle
 * has no equivalent in a non-web adapter. Callers just thread whatever the
 * adapter returned back into a later saveFile() call without inspecting it.
 */
export interface StorageAdapter {
  saveDocument(path: string, content: string): Promise<void>
  loadDocument(path: string): Promise<string | null>
  listVersions(path: string): Promise<VersionEntry[]>

  openFile(): Promise<{ name: string; content: string; handle: unknown } | null>
  openDocx(): Promise<{ name: string; buffer: ArrayBuffer } | null>
  openStyleJson(): Promise<{ name: string; text: string } | null>
  saveFile(
    name: string,
    content: string,
    existingHandle?: unknown,
  ): Promise<{ savedName: string; handle: unknown } | null>

  saveStyle(style: ScreenplayStyleDefinition): Promise<void>
  loadAllStyles(): Promise<ScreenplayStyleDefinition[]>
  deleteStyle(id: string): Promise<void>

  /**
   * Optional: lets a restored session (see DocumentContext's boot-recovery
   * effect) keep writing straight back to the file the user had open instead
   * of forcing Save As. Adapters without a handle concept (Cloud, or a
   * browser build with no persisted-handle support) simply omit these; the
   * caller feature-detects with `?.`. `restoreFileHandle` should only ever
   * return a handle that's usable without prompting — if permission would
   * need to be re-requested, return null and let the user Save As instead.
   */
  persistFileHandle?(path: string, handle: unknown): Promise<void>
  restoreFileHandle?(path: string): Promise<unknown | null>

  /**
   * Optional: delete all saved versions of a document. Used by the version
   * history UI's "clear all versions" action.
   */
  deleteAllVersions?(path: string): Promise<void>
}

const StorageAdapterContext = createContext<StorageAdapter | null>(null)

export const StorageAdapterProvider = StorageAdapterContext.Provider

export function useStorageAdapter(): StorageAdapter {
  const adapter = useContext(StorageAdapterContext)
  if (!adapter) throw new Error('useStorageAdapter must be used inside a StorageAdapterProvider (DocumentProvider supplies one)')
  return adapter
}
