// Types for window.desktopAPI exposed by desktop container shells — keep in sync.
interface DesktopAPI {
  readFile:       (path: string) => Promise<string>
  writeFile:      (path: string, content: string) => Promise<void>
  showOpenDialog: () => Promise<string | null>
  showSaveDialog: (defaultName: string) => Promise<string | null>
  // Keyring & AI API bridge for Tauri desktop
  getApiKey?:       (provider: string) => Promise<string | null>
  setApiKey?:       (provider: string, key: string) => Promise<void>
  deleteApiKey?:    (provider: string) => Promise<void>
  callProviderApi?: (
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any
  ) => Promise<{ status: number; data: any }>
  onMenuCommand:  (callback: (command: string) => void) => () => void
  // Native PDF export (Windows only — WebView2 PrintToPdf). Absent on other
  // platforms; callers must feature-detect before use.
  showSavePdfDialog?:     (defaultName: string) => Promise<string | null>
  exportScreenplayToPdf?: (html: string, path: string) => Promise<void>
  // Disk-backed autosave (format spec §3.2: IndexedDB on web, disk on
  // desktop). local-storage-adapter.ts prefers these over IndexedDB when present.
  autosaveWrite?: (key: string, content: string) => Promise<void>
  autosaveRead?:  (key: string) => Promise<string | null>
  // Native window-close guard: beforeunload isn't reliably fired by a native
  // close (vs. an in-page reload) across WRY's backing webviews, so the Rust
  // side intercepts CloseRequested and asks the frontend via this event
  // instead of closing immediately.
  onCloseRequested?: (callback: () => void) => () => void
  closeWindow?: () => Promise<void>
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI
  }
}

export {}
