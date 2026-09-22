import type { EditorView } from 'prosemirror-view'
import type { Command } from 'prosemirror-state'
import type { EditorView as CmEditorView } from '@codemirror/view'

let currentView: EditorView | null = null
let currentSourceView: CmEditorView | null = null
const listeners = new Set<() => void>()

export function setEditorView(view: EditorView | null): void {
  currentView = view
  emit()
}

export function getEditorView(): EditorView | null {
  return currentView
}

export function setSourceView(view: CmEditorView | null): void {
  currentSourceView = view
}

export function getSourceView(): CmEditorView | null {
  return currentSourceView
}

export function runCommand(cmd: Command): void {
  if (!currentView) return
  cmd(currentView.state, currentView.dispatch, currentView)
  currentView.focus()
}

export function activeBlockType(): string | null {
  if (!currentView) return null
  return currentView.state.selection.$from.parent.type.name
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emit(): void {
  listeners.forEach(fn => fn())
}

/** Window event that opens the title page form (TitlePageDialog, mounted by AppShell). */
export const OPEN_TITLE_PAGE_EVENT = 'cs:open-title-page'

export function openTitlePageForm(): void {
  window.dispatchEvent(new CustomEvent(OPEN_TITLE_PAGE_EVENT))
}
