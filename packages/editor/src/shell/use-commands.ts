import { useMemo } from 'react'
import { useDocument } from '../context/DocumentContext'
import { useTranslation } from '../i18n/useTranslation'
import { useCanEdit } from '../extensions/session'
import { useCommandRegistry } from '../extensions/command-registry'
import type { CommandContext, CommandContribution } from '../extensions/command-registry'
import { useRegistryList, withBuiltins } from '../extensions/registry-store'
import { getEditorView, getSourceView } from '../editor/editor-bus'
import { builtinCommands } from './builtin-commands'

/** Built-in + registered commands available in this session (read-only sessions keep only `readOnly` ones). */
export function useCommands(): CommandContribution[] {
  const { t } = useTranslation()
  const canEdit = useCanEdit()
  const registered = useRegistryList(useCommandRegistry())
  return useMemo(
    () => withBuiltins(builtinCommands(t), registered).filter(c => canEdit || c.readOnly),
    [t, registered, canEdit],
  )
}

/** A CommandContext for the current moment. */
export function useCommandContext(): () => CommandContext {
  const { mode, text, setText } = useDocument()
  return () => ({ view: getEditorView(), sourceView: getSourceView(), mode, text, setText })
}

/** `Alt-Shift-H` → `Alt+Shift+H` for tooltips. */
export function displayShortcut(shortcut: string | undefined): string | undefined {
  return shortcut?.split(/[-+](?=.)/).join('+')
}
