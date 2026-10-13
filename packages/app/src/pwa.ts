/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

let updateReady = false
let applyUpdate: (() => Promise<void>) | undefined
const listeners = new Set<() => void>()

export const subscribeUpdateReady = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
export const getUpdateReady = () => updateReady
/** Activates the waiting service worker and reloads the page. */
export const reloadForUpdate = () => applyUpdate?.()

// registerType is 'prompt': a new build waits until the user accepts, so a reload never discards edits.
export function registerServiceWorker() {
  applyUpdate = async () => updateSW(true)
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true
      listeners.forEach((fn) => fn())
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => { if (navigator.onLine) registration.update().catch(() => {}) }
      setInterval(check, CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}
