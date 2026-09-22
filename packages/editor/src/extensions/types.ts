/**
 * Type-only extension-point surface (OSS spec §11.5). These declare the shape
 * embedders (Sutrata Cloud, third-party plugins) will implement, but nothing
 * in @sutrata/editor is wired to them yet — ai-client.ts and voice-service.ts
 * are still direct imports within this package, not injected. Promoting them
 * to real dependency-injected providers (matching StorageAdapter's pattern in
 * ./storage-adapter.ts) is future work; see docs/TODO.
 *
 * [P1 interface, stable by P2] per the OSS spec — these shapes may still
 * change before they're load-bearing.
 */

/** LLM completion with streaming; declares capabilities and data-policy text for disclosure. */
export interface AIProvider {
  id: string
  displayName: string
  dataPolicyText: string
  complete(prompt: string, opts?: { stream?: boolean }): Promise<string>
}

/** Speech-to-text. */
export interface SpeechProvider {
  id: string
  displayName: string
  transcribe(audio: Blob, opts?: { language?: string }): Promise<string>
}

/** Current user identity, permissions (read-only, comment, edit), feature flags. */
export interface SessionContext {
  userId: string | null
  displayName: string | null
  permission: 'read' | 'comment' | 'edit'
  featureFlags: Record<string, boolean>
}

/** Add side panels, inspector sections, and app-bar items; receives the AST and scene IDs. */
export interface PanelRegistry {
  registerPanel(panel: { id: string; title: string; render: () => unknown }): void
}

/** Add commands, menu items, keyboard shortcuts. */
export interface CommandRegistry {
  registerCommand(command: { id: string; label: string; run: () => void; shortcut?: string }): void
}

/** Add export formats and report types. */
export interface ExportRegistry {
  registerExporter(exporter: { id: string; label: string; run: (text: string) => Promise<Blob> }): void
}

/** Hook to bind the editor state to an external real-time sync provider (e.g. a Yjs document). */
export interface CollabBinding {
  bind(): () => void
}

/** Render external annotations (comments, breakdown highlights, revision marks) anchored to
 *  scene IDs and text ranges. */
export interface DecorationProvider {
  getDecorations(sceneId: string): Array<{ from: number; to: number; className: string }>
}
