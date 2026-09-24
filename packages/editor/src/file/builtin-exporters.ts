import { exportFountain } from '@sutrata/parser'
import type { ExportContribution, ExportContext } from '../extensions/export-registry'
import { exportToDocx } from './docx-exporter'
import {
  extractWorkflowData,
  exportOneLinerCsv, exportShotListCsv, exportCastReportCsv,
  exportOneLinerDocx, exportShotListDocx, exportCastReportDocx,
  openPrintPreview, openScreenplayPrintPreview,
} from './workflow-reports'

type Translate = (key: string) => string

/** Short descriptions of the built-in report families, shown under each report's title. */
const REPORT_DESCRIPTIONS: Record<string, string> = {
  'One-Liner Schedule': 'A scene-by-scene production stripboard breakdown with locations, cast, and timings.',
  'Shot List': 'Camera shot specifications extracted from scene headings and production notes.',
  'Cast Breakdown': 'Character occurrences, dialogue counts, and assigned actors list.',
}

const suffix = (ctx: ExportContext) => (ctx.options.romanized ? '_romanized' : '')
const titleSuffix = (ctx: ExportContext) => (ctx.options.romanized ? ' (ROMANIZED)' : '')

/** CSV with a BOM so Excel reads UTF-8 (Indic text) correctly. */
function csv(content: string): Blob {
  return new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' })
}

function report(
  id: string, family: string, formatLabel: string, ext: 'docx' | 'csv' | null, stem: string,
  run: ExportContribution['run'], successMessage: string,
): ExportContribution {
  return {
    id, label: `${family} — ${formatLabel}`, group: 'report', family, formatLabel,
    description: REPORT_DESCRIPTIONS[family],
    supports: { romanize: true },
    run,
    fileName: ctx => `${ctx.baseName}_${stem}${suffix(ctx)}.${ext ?? 'html'}`,
    successMessage,
  }
}

/**
 * The editor's own export formats and reports, registered like an
 * embedder's. PDF and print views open a print preview window instead of
 * returning a file; their run() must open it synchronously (popup blockers).
 */
export function builtinExporters(t: Translate): ExportContribution[] {
  return [
    {
      id: 'pdf', label: 'PDF / Print Preview', group: 'screenplay',
      description: 'Print-ready industry screenplay layout styled according to your active visual template.',
      supports: { style: true, skipNotes: true, romanize: true },
      run: async ctx => {
        const title = `${ctx.baseName.toUpperCase()} - SCREENPLAY${titleSuffix(ctx)}`
        await openScreenplayPrintPreview(ctx.ast, title, ctx.options.styleId, ctx.customStyles, ctx.options.skipNotes)
      },
      fileName: ctx => `${ctx.baseName}${suffix(ctx)}.pdf`,
      successMessage: 'Opened Screenplay Print Preview',
    },
    {
      id: 'docx', label: 'Microsoft Word (.docx)', group: 'screenplay',
      description: t('export.docxDesc'),
      supports: { style: true, skipNotes: true, romanize: true },
      run: ctx => exportToDocx(ctx.ast, ctx.options.styleId, ctx.customStyles, ctx.options.skipNotes),
      fileName: ctx => `${ctx.baseName}${suffix(ctx)}.docx`,
      successMessage: 'Exported Word document (.docx)',
    },
    {
      id: 'fountain', label: 'Fountain (.fountain)', group: 'screenplay',
      description: t('export.fountainDesc'),
      run: async ctx => {
        const result = exportFountain(ctx.ast)
        return { blob: new Blob([result.text], { type: 'text/plain;charset=utf-8' }), warnings: result.warnings }
      },
      fileName: ctx => `${ctx.baseName}.fountain`,
      successMessage: 'Exported Fountain screenplay',
    },
    report('oneliner-print', 'One-Liner Schedule', 'Print View', null, 'one_liner', async ctx => {
      await openPrintPreview(extractWorkflowData(ctx.ast).scenes, `${ctx.baseName.toUpperCase()} - ONE-LINER SCHEDULE${titleSuffix(ctx)}`)
    }, 'Opened One-Liner Schedule'),
    report('oneliner-docx', 'One-Liner Schedule', 'Word (.docx)', 'docx', 'one_liner',
      ctx => exportOneLinerDocx(extractWorkflowData(ctx.ast).scenes), 'Exported One-Liner DOCX'),
    report('oneliner-csv', 'One-Liner Schedule', 'Spreadsheet (.csv)', 'csv', 'one_liner',
      async ctx => csv(exportOneLinerCsv(extractWorkflowData(ctx.ast).scenes)), 'Exported One-Liner CSV'),
    report('shotlist-docx', 'Shot List', 'Word (.docx)', 'docx', 'shot_list',
      ctx => exportShotListDocx(extractWorkflowData(ctx.ast).scenes), 'Exported Shot List DOCX'),
    report('shotlist-csv', 'Shot List', 'Spreadsheet (.csv)', 'csv', 'shot_list',
      async ctx => csv(exportShotListCsv(extractWorkflowData(ctx.ast).scenes)), 'Exported Shot List CSV'),
    report('cast-docx', 'Cast Breakdown', 'Word (.docx)', 'docx', 'cast_report',
      ctx => exportCastReportDocx(extractWorkflowData(ctx.ast).characters), 'Exported Cast Report DOCX'),
    report('cast-csv', 'Cast Breakdown', 'Spreadsheet (.csv)', 'csv', 'cast_report',
      async ctx => csv(exportCastReportCsv(extractWorkflowData(ctx.ast).characters)), 'Exported Cast Report CSV'),
  ]
}
