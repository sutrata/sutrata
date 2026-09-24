import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { EditorView } from 'prosemirror-view'
import type { EditorView as SourceEditorView } from '@codemirror/view'
import type { EditorMode } from '../types'
import { createRegistryStore } from './registry-store'
import type { RegistryStore } from './registry-store'

export interface CommandContext {
  /** The formatted editor, when it is mounted. */
  view: EditorView | null
  /** The source editor, when it is mounted. */
  sourceView: SourceEditorView | null
  mode: EditorMode
  text: string
  setText(next: string): void
}

/**
 * A command contributed by the embedder or built into the editor (OSS spec §11.5).
 *
 * - `shortcut`: a key binding such as `Mod-Shift-K` or `Alt-Shift-H` (`Mod` is
 *   Ctrl, or Cmd on macOS; `-` or `+` separate parts). Handled globally, in
 *   both editing modes.
 * - `shortcutHint`: shown in tooltips only — for keys something else already
 *   binds (e.g. ProseMirror's Mod-B).
 * - `menu`: `toolbar` places it in the element toolbar (in `group`),
 *   `appbar` in the app bar.
 * - `readOnly: true` keeps it available in read/comment sessions; otherwise
 *   it is hidden and its shortcut inactive there.
 */
export interface CommandContribution {
  id: string
  label: string
  run(ctx: CommandContext): void
  shortcut?: string
  shortcutHint?: string
  menu?: 'toolbar' | 'appbar'
  group?: string
  /** Icon at the requested pixel size. */
  icon?: (size: number) => ReactNode
  /** Short syntax hint shown under toolbar labels (e.g. the `@` sigil). */
  sigil?: string
  /** Highlights the toolbar button (e.g. the block type at the caret). */
  isActive?(ctx: CommandContext): boolean
  readOnly?: boolean
}

export type CommandRegistry = RegistryStore<CommandContribution>

export function createCommandRegistry(initial: CommandContribution[] = []): CommandRegistry {
  return createRegistryStore(initial)
}

const CommandRegistryContext = createContext<CommandRegistry>(createCommandRegistry())

export const CommandRegistryProvider = CommandRegistryContext.Provider

export function useCommandRegistry(): CommandRegistry {
  return useContext(CommandRegistryContext)
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** True when `e` matches a binding like `Mod-Shift-K` / `Alt+Shift+H`. */
export function matchesShortcut(shortcut: string, e: KeyboardEvent): boolean {
  const parts = shortcut.split(/[-+](?=.)/)
  const key = parts.pop()!
  const mods = new Set(parts.map(p => p.toLowerCase()))
  const wantCtrl = mods.has('ctrl') || (mods.has('mod') && !IS_MAC)
  const wantMeta = mods.has('cmd') || mods.has('meta') || (mods.has('mod') && IS_MAC)
  if (e.ctrlKey !== wantCtrl || e.metaKey !== wantMeta) return false
  if (e.altKey !== mods.has('alt') || e.shiftKey !== mods.has('shift')) return false
  if (/^[a-z]$/i.test(key)) return e.code === `Key${key.toUpperCase()}`
  if (/^[0-9]$/.test(key)) return e.code === `Digit${key}`
  return e.key.toLowerCase() === key.toLowerCase()
}
