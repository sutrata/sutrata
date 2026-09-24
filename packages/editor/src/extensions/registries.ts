import { createPanelRegistry } from './panel-registry'
import type { PanelRegistry } from './panel-registry'
import { createCommandRegistry } from './command-registry'
import type { CommandRegistry } from './command-registry'
import { createExportRegistry } from './export-registry'
import type { ExportRegistry } from './export-registry'

export interface Registries {
  panels: PanelRegistry
  commands: CommandRegistry
  exporters: ExportRegistry
}

/**
 * Live registries for DocumentProvider's `panels` / `commands` / `exporters`
 * props. Register up front or at runtime; each `register()` returns an
 * unregister function. The editor's built-ins are not in these registries —
 * registering an entry with a built-in's id replaces it.
 */
export function createRegistries(): Registries {
  return { panels: createPanelRegistry(), commands: createCommandRegistry(), exporters: createExportRegistry() }
}
