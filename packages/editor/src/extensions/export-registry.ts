import { createContext, useContext } from 'react'
import type { DocumentNode, RomanizeVariant } from '@sutrata/parser'
import type { ScreenplayStyleDefinition } from '../styles/types'
import { createRegistryStore } from './registry-store'
import type { RegistryStore } from './registry-store'

export interface ExportOptions {
  /** Style chosen in the dialog (screenplay exports), or undefined for the document's own. */
  styleId?: string
  skipNotes: boolean
  /** Set when `text`/`ast` are a romanized copy (Indic → ISO 15919). */
  romanized: { scope: 'all' | 'dialogue'; variant: RomanizeVariant } | null
}

export interface ExportContext {
  /** The document — or its romanized copy, see options.romanized. */
  text: string
  ast: DocumentNode
  /** The document's resolved style. */
  style: ScreenplayStyleDefinition
  customStyles: ScreenplayStyleDefinition[]
  options: ExportOptions
  /** File name without extension, from the open document. */
  baseName: string
}

/** What `run` produced: a file to download (optionally with warnings), or nothing if it handled output itself. */
export type ExportOutput = Blob | { blob?: Blob; warnings?: string[] } | void

/**
 * An export format or report contributed by the embedder or built into the
 * editor (OSS spec §11.5). The Export dialog renders every registered
 * exporter: `screenplay` ones as cards, `report` ones grouped by `family`
 * with `formatLabel` chips.
 */
export interface ExportContribution {
  id: string
  label: string
  group: 'screenplay' | 'report'
  description?: string
  /** Reports: the report this format belongs to (e.g. "Shot List"). */
  family?: string
  /** Reports: the chip label (e.g. "Word (.docx)"). */
  formatLabel?: string
  /** Which dialog options apply. */
  supports?: { style?: boolean; skipNotes?: boolean; romanize?: boolean }
  run(ctx: ExportContext): Promise<ExportOutput>
  fileName(ctx: ExportContext): string
  /** Toast shown after a successful export. */
  successMessage?: string
}

export type ExportRegistry = RegistryStore<ExportContribution>

export function createExportRegistry(initial: ExportContribution[] = []): ExportRegistry {
  return createRegistryStore(initial)
}

const ExportRegistryContext = createContext<ExportRegistry>(createExportRegistry())

export const ExportRegistryProvider = ExportRegistryContext.Provider

export function useExportRegistry(): ExportRegistry {
  return useContext(ExportRegistryContext)
}
