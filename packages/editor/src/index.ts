// Public entry point for @sutrata/editor.
// Re-exported so consumers (e.g. @sutrata/app) get the ambient `Window.desktopAPI`
// augmentation from dist/, not just from source — a loose sibling .d.ts in dist/
// isn't picked up by a downstream tsconfig on its own.
export type * from './desktop-api'

export { DocumentProvider, useDocument } from './context/DocumentContext'
export type { FindMode, DocumentProviderProps } from './context/DocumentContext'
export { AppShell } from './shell/AppShell'
export { LanguageProvider, useLanguage } from './i18n/LanguageContext'
export { TranslationProvider, useTranslation } from './i18n/useTranslation'

export type { EditorMode, VersionEntry } from './types'
export type { ScreenplayStyleDefinition } from './styles/types'

export type { StorageAdapter } from './extensions/storage-adapter'
export { useStorageAdapter } from './extensions/storage-adapter'
export type { AIProvider, AIRequest, AIActivity, JsonSchema } from './extensions/ai-provider'
export { useAI } from './extensions/ai-provider'
export type {
  SpeechProvider, SpeechRecognitionCallbacks, SpeechRecognitionSession,
} from './extensions/speech-provider'
export { useSpeech } from './extensions/speech-provider'
export type { SessionContext } from './extensions/session'
export { DEFAULT_SESSION, useSession, useCanEdit } from './extensions/session'
export type {
  PanelRegistry, PanelContribution, PanelLocation, PanelRenderContext,
} from './extensions/panel-registry'
export { createPanelRegistry, usePanelRegistry } from './extensions/panel-registry'
export type {
  DecorationProvider, DecorationSpec, DecorationContext, Anchor,
} from './extensions/decorations'
export type { CollabBinding } from './extensions/collab'
export type {
  CommandRegistry, CommandContribution, CommandContext,
} from './extensions/command-registry'
export { createCommandRegistry, useCommandRegistry } from './extensions/command-registry'
export type {
  ExportRegistry, ExportContribution, ExportContext, ExportOptions, ExportOutput,
} from './extensions/export-registry'
export { createExportRegistry, useExportRegistry } from './extensions/export-registry'
export type { Registries } from './extensions/registries'
export { createRegistries } from './extensions/registries'
