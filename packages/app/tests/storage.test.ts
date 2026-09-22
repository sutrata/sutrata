import { describe, it, expect, beforeEach } from 'vitest'
import { saveDocument, saveVersion, listVersions, deleteAllVersions, loadDocument } from '../src/file/storage'

// In-memory IndexedDB mock tailored to Sutrata's storage requirements
function setupIndexedDBMock() {
  const stores = new Map<string, Map<any, any>>()

  function getStore(name: string): Map<any, any> {
    if (!stores.has(name)) {
      stores.set(name, new Map())
    }
    return stores.get(name)!
  }

  const mockDb = {
    objectStoreNames: {
      contains: (name: string) => stores.has(name),
    },
    createObjectStore: (name: string, { keyPath }: { keyPath: string }) => {
      getStore(name)
      return {
        createIndex: () => {},
      }
    },
    transaction: (storeNames: string | string[], _mode: string) => {
      const tx = {
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        objectStore: (storeName: string) => {
          const storeMap = getStore(storeName)
          return {
            put: (value: any) => {
              const key = value.id ?? value.path
              storeMap.set(key, JSON.parse(JSON.stringify(value)))
            },
            add: (value: any) => {
              const key = value.id ?? value.path
              storeMap.set(key, JSON.parse(JSON.stringify(value)))
            },
            get: (key: any) => {
              const req: any = { result: storeMap.get(key), onsuccess: null, onerror: null }
              queueMicrotask(() => req.onsuccess?.())
              return req
            },
            getAll: () => {
              const req: any = { result: Array.from(storeMap.values()), onsuccess: null, onerror: null }
              queueMicrotask(() => req.onsuccess?.())
              return req
            },
            delete: (key: any) => {
              storeMap.delete(key)
            },
            index: (_indexName: string) => ({
              getAll: (range?: any) => {
                const targetPath = range?.target ?? range
                const all = Array.from(storeMap.values())
                const matching = targetPath
                  ? all.filter((v: any) => v.path === targetPath)
                  : all
                const req: any = { result: matching, onsuccess: null, onerror: null }
                queueMicrotask(() => req.onsuccess?.())
                return req
              },
            }),
          }
        },
      }
      queueMicrotask(() => {
        tx.oncomplete?.()
      })
      return tx
    },
  }

  const mockIndexedDB = {
    open: (_name: string, _version: number) => {
      const req: any = {
        result: mockDb,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      }
      queueMicrotask(() => {
        req.onupgradeneeded?.()
        req.onsuccess?.()
      })
      return req
    },
  }

  // @ts-expect-error mock assignment
  globalThis.indexedDB = mockIndexedDB
  // @ts-expect-error mock assignment
  globalThis.IDBKeyRange = {
    only: (val: any) => ({ target: val }),
  }
}

describe('storage version differential saving', () => {
  beforeEach(() => {
    setupIndexedDBMock()
  })

  it('saves initial version when no previous versions exist', async () => {
    const path = 'test.sutra'
    const content = 'INT. HOUSE - DAY\n\nInitial version.'

    const saved = await saveVersion(path, content)
    expect(saved).toBe(true)

    const versions = await listVersions(path)
    expect(versions).toHaveLength(1)
    expect(versions[0]!.content).toBe(content)
  })

  it('does NOT save a new version when content has no difference against previous version', async () => {
    const path = 'test.sutra'
    const content = 'INT. HOUSE - DAY\n\nInitial version.'

    // First save
    await saveVersion(path, content)
    const initialVersions = await listVersions(path)
    expect(initialVersions).toHaveLength(1)

    // Second save with identical content
    const savedSecond = await saveVersion(path, content)
    expect(savedSecond).toBe(false)

    // Version list count must remain unchanged
    const afterSecond = await listVersions(path)
    expect(afterSecond).toHaveLength(1)
    expect(afterSecond[0]!.id).toBe(initialVersions[0]!.id)
  })

  it('saves a new version when content differs from previous version', async () => {
    const path = 'test.sutra'
    const content1 = 'INT. HOUSE - DAY\n\nVersion one.'
    const content2 = 'INT. HOUSE - DAY\n\nVersion two with changes.'

    await saveVersion(path, content1)
    const saved2 = await saveVersion(path, content2)
    expect(saved2).toBe(true)

    const versions = await listVersions(path)
    expect(versions).toHaveLength(2)
    expect(versions[0]!.content).toBe(content2)
    expect(versions[1]!.content).toBe(content1)
  })

  it('saves a new version when reverting back to an older version (different from immediate previous)', async () => {
    const path = 'test.sutra'
    const content1 = 'INT. HOUSE - DAY\n\nVersion one.'
    const content2 = 'INT. HOUSE - DAY\n\nVersion two.'

    await saveVersion(path, content1)
    await saveVersion(path, content2)

    // Revert back to content1: differs from previous (which is content2)
    const saved3 = await saveVersion(path, content1)
    expect(saved3).toBe(true)

    const versions = await listVersions(path)
    expect(versions).toHaveLength(3)
    expect(versions[0]!.content).toBe(content1)
    expect(versions[1]!.content).toBe(content2)
    expect(versions[2]!.content).toBe(content1)

    // Saving content1 again immediately should NOT create a 4th version
    const saved4 = await saveVersion(path, content1)
    expect(saved4).toBe(false)
    const finalVersions = await listVersions(path)
    expect(finalVersions).toHaveLength(3)
  })

  it('saveDocument updates document content for recovery without creating versions (autosave safety)', async () => {
    const path = 'screenplay.sutra'
    const content1 = 'INT. COFFEE SHOP - DAY\n\nDraft 1'

    // Autosave writes to document store
    await saveDocument(path, content1)
    expect(await loadDocument(path)).toBe(content1)
    // No versions created by autosave
    expect(await listVersions(path)).toHaveLength(0)

    // Explicit version save creates the version
    await saveVersion(path, content1)
    expect(await listVersions(path)).toHaveLength(1)

    // Autosaving newer content does not create an unprompted version snapshot
    const content2 = 'INT. COFFEE SHOP - DAY\n\nDraft 2'
    await saveDocument(path, content2)
    expect(await loadDocument(path)).toBe(content2)
    expect(await listVersions(path)).toHaveLength(1)
  })

  it('allows saving after deleteAllVersions clears history', async () => {
    const path = 'screenplay.sutra'
    const content = 'INT. SCENE - NIGHT'

    await saveVersion(path, content)
    expect(await listVersions(path)).toHaveLength(1)

    await deleteAllVersions(path)
    expect(await listVersions(path)).toHaveLength(0)

    // Saving again should now create a new version since no previous versions exist
    const saved = await saveVersion(path, content)
    expect(saved).toBe(true)
    expect(await listVersions(path)).toHaveLength(1)
  })
})
