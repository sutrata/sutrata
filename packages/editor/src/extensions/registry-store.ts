import { useSyncExternalStore } from 'react'

/**
 * The live list behind every registry (panels, commands, exporters).
 * `register` replaces an entry with the same id and returns an unregister
 * function; `list` returns the same array until something changes, so it can
 * back useSyncExternalStore.
 */
export interface RegistryStore<T extends { id: string }> {
  register(entry: T): () => void
  list(): readonly T[]
  subscribe(listener: () => void): () => void
}

export function createRegistryStore<T extends { id: string }>(initial: readonly T[] = []): RegistryStore<T> {
  let entries: readonly T[] = [...initial]
  const listeners = new Set<() => void>()
  const set = (next: readonly T[]) => {
    entries = next
    for (const l of listeners) l()
  }
  return {
    register(entry) {
      set([...entries.filter(e => e.id !== entry.id), entry])
      return () => set(entries.filter(e => e !== entry))
    },
    list: () => entries,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

export function useRegistryList<T extends { id: string }>(store: RegistryStore<T>): readonly T[] {
  return useSyncExternalStore(store.subscribe, store.list, store.list)
}

/**
 * Built-in entries followed by registered ones; a registered entry with a
 * built-in's id replaces it in place.
 */
export function withBuiltins<T extends { id: string }>(builtins: readonly T[], registered: readonly T[]): T[] {
  const byId = new Map(registered.map(e => [e.id, e]))
  return [
    ...builtins.map(b => byId.get(b.id) ?? b),
    ...registered.filter(e => !builtins.some(b => b.id === e.id)),
  ]
}
