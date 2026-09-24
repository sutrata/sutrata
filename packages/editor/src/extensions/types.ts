/**
 * Type-only extension-point surface (OSS spec §11.5) for the points that are
 * not wired yet. AIProvider, SpeechProvider, SessionContext, PanelRegistry
 * and StorageAdapter are real, injected through DocumentProvider — see their
 * own modules in this directory.
 *
 * [P1 interface, stable by P2] per the OSS spec — these shapes may still
 * change before they're load-bearing.
 */

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
