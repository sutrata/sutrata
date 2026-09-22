// Public entry point for @sutrata/editor.
// Re-exported so consumers (e.g. @sutrata/app) get the ambient `Window.desktopAPI`
// augmentation from dist/, not just from source — a loose sibling .d.ts in dist/
// isn't picked up by a downstream tsconfig on its own.
export type * from './desktop-api'

export { DocumentProvider, useDocument } from './context/DocumentContext'
export type { FindMode } from './context/DocumentContext'
export { AppShell } from './shell/AppShell'
export { LanguageProvider, useLanguage } from './i18n/LanguageContext'
export { TranslationProvider, useTranslation } from './i18n/useTranslation'

export type { EditorMode, VersionEntry } from './types'
export type { ScreenplayStyleDefinition } from './styles/types'

export type { StorageAdapter } from './extensions/storage-adapter'
export { useStorageAdapter } from './extensions/storage-adapter'
export type {
  AIProvider,
  SpeechProvider,
  SessionContext,
  PanelRegistry,
  CommandRegistry,
  ExportRegistry,
  CollabBinding,
  DecorationProvider,
} from './extensions/types'
