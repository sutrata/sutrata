import type { VersionEntry, ScreenplayStyleDefinition } from '@sutrata/editor'

const DB_NAME = 'sutrata'
const STORE_DOCS = 'documents'
const STORE_VERSIONS = 'versions'
const STORE_STYLES = 'styles'
const STORE_HANDLES = 'fileHandles'
const DB_VERSION = 3
const MAX_VERSIONS = 50

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        db.createObjectStore(STORE_DOCS, { keyPath: 'path' })
      }
      if (!db.objectStoreNames.contains(STORE_VERSIONS)) {
        const vs = db.createObjectStore(STORE_VERSIONS, { keyPath: 'id' })
        vs.createIndex('path', 'path', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_STYLES)) {
        db.createObjectStore(STORE_STYLES, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES, { keyPath: 'path' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

type PermissibleHandle = {
  queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
}

/** Lets a restored session keep writing to the same on-disk file (StorageAdapter's
 *  optional persistFileHandle/restoreFileHandle — see extensions/storage-adapter.ts). */
export async function saveFileHandle(path: string, handle: unknown): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_HANDLES, 'readwrite')
    tx.objectStore(STORE_HANDLES).put({ path, handle })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadFileHandle(path: string): Promise<unknown | null> {
  const db = await openDb()
  const handle = await new Promise<unknown | null>((resolve, reject) => {
    const tx = db.transaction(STORE_HANDLES, 'readonly')
    const req = tx.objectStore(STORE_HANDLES).get(path)
    req.onsuccess = () => resolve((req.result as { handle: unknown } | undefined)?.handle ?? null)
    req.onerror = () => reject(req.error)
  })
  if (!handle) return null
  // Only hand back a handle that's usable without prompting — the File System
  // Access permission model can't be silently re-escalated outside a user
  // gesture, so if it's not already granted, let the caller fall back to Save As.
  try {
    const permission = await (handle as PermissibleHandle).queryPermission({ mode: 'readwrite' })
    return permission === 'granted' ? handle : null
  } catch {
    return null
  }
}

/** User-imported custom screenplay styles (built-in styles live in code, not here). */
export async function saveStyle(style: ScreenplayStyleDefinition): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_STYLES, 'readwrite')
    tx.objectStore(STORE_STYLES).put(style)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadAllStyles(): Promise<ScreenplayStyleDefinition[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STYLES, 'readonly')
    const req = tx.objectStore(STORE_STYLES).getAll()
    req.onsuccess = () => resolve(req.result as ScreenplayStyleDefinition[])
    req.onerror = () => reject(req.error)
  })
}

export async function deleteStyle(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_STYLES, 'readwrite')
    tx.objectStore(STORE_STYLES).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function saveDocument(path: string, content: string): Promise<void> {
  const db = await openDb()
  const now = Date.now()
  const versionId = `${path}__${now}_${Math.random().toString(36).slice(2)}`
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_DOCS, STORE_VERSIONS], 'readwrite')
    tx.objectStore(STORE_DOCS).put({ path, content, savedAt: now })
    tx.objectStore(STORE_VERSIONS).add({ id: versionId, path, content, timestamp: now })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  await pruneVersions(path)
}

export async function loadDocument(path: string): Promise<string | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCS, 'readonly')
    const req = tx.objectStore(STORE_DOCS).get(path)
    req.onsuccess = () => resolve((req.result as { content: string } | undefined)?.content ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function listVersions(path: string): Promise<VersionEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VERSIONS, 'readonly')
    const idx = tx.objectStore(STORE_VERSIONS).index('path')
    const req = idx.getAll(IDBKeyRange.only(path))
    req.onsuccess = () => {
      const entries: VersionEntry[] = (req.result as { id: string; timestamp: number; content: string }[])
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(r => ({ id: r.id, timestamp: r.timestamp, content: r.content }))
      resolve(entries)
    }
    req.onerror = () => reject(req.error)
  })
}

async function pruneVersions(path: string): Promise<void> {
  const versions = await listVersions(path)
  if (versions.length <= MAX_VERSIONS) return
  const toDelete = versions.slice(MAX_VERSIONS)
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_VERSIONS, 'readwrite')
    const store = tx.objectStore(STORE_VERSIONS)
    for (const v of toDelete) store.delete(v.id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteAllVersions(path: string): Promise<void> {
  const versions = await listVersions(path)
  if (versions.length === 0) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_VERSIONS, 'readwrite')
    const store = tx.objectStore(STORE_VERSIONS)
    for (const v of versions) store.delete(v.id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
