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


const suffix = (ctx: ExportContext) => (ctx.options.romanized ? '_romanized' : '')
const titleSuffix = (ctx: ExportContext) => (ctx.options.romanized ? ' (ROMANIZED)' : '')

/** CSV with a BOM so Excel reads UTF-8 (Indic text) correctly. */
function csv(content: string): Blob {
  return new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' })
}

function report(
  t: Translate, id: string, familyKey: string, formatKey: string, ext: 'docx' | 'csv' | null, stem: string,
  run: ExportContribution['run'], successKey: string,
): ExportContribution {
  const family = t(`export.family.${familyKey}`)
  const formatLabel = t(`export.format.${formatKey}`)
  return {
    id, label: `${family} — ${formatLabel}`, group: 'report', family, formatLabel,
    description: t(`export.family.${familyKey}.desc`),
    supports: { romanize: true },
    run,
    fileName: ctx => `${ctx.baseName}_${stem}${suffix(ctx)}.${ext ?? 'html'}`,
    successMessage: t(successKey),
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
      id: 'pdf', label: t('export.pdfLabel'), group: 'screenplay',
      description: t('export.pdfDesc'),
      supports: { style: true, skipNotes: true, romanize: true },
      run: async ctx => {
        const title = `${ctx.baseName.toUpperCase()} - SCREENPLAY${titleSuffix(ctx)}`
        await openScreenplayPrintPreview(ctx.ast, title, ctx.options.styleId, ctx.customStyles, ctx.options.skipNotes)
      },
      fileName: ctx => `${ctx.baseName}${suffix(ctx)}.pdf`,
      successMessage: t('export.done.pdf'),
    },
    {
      id: 'docx', label: t('export.docxLabel'), group: 'screenplay',
      description: t('export.docxDesc'),
      supports: { style: true, skipNotes: true, romanize: true },
      run: ctx => exportToDocx(ctx.ast, ctx.options.styleId, ctx.customStyles, ctx.options.skipNotes),
      fileName: ctx => `${ctx.baseName}${suffix(ctx)}.docx`,
      successMessage: t('export.done.docx'),
    },
    {
      id: 'fountain', label: t('export.fountainLabel'), group: 'screenplay',
      description: t('export.fountainDesc'),
      run: async ctx => {
        const result = exportFountain(ctx.ast)
        return { blob: new Blob([result.text], { type: 'text/plain;charset=utf-8' }), warnings: result.warnings }
      },
      fileName: ctx => `${ctx.baseName}.fountain`,
      successMessage: t('export.done.fountain'),
    },
    report(t, 'oneliner-print', 'oneliner', 'print', null, 'one_liner', async ctx => {
      await openPrintPreview(extractWorkflowData(ctx.ast).scenes, `${ctx.baseName.toUpperCase()} - ONE-LINER SCHEDULE${titleSuffix(ctx)}`)
    }, 'export.done.oneliner.print'),
    report(t, 'oneliner-docx', 'oneliner', 'docx', 'docx', 'one_liner',
      ctx => exportOneLinerDocx(extractWorkflowData(ctx.ast).scenes), 'export.done.oneliner.docx'),
    report(t, 'oneliner-csv', 'oneliner', 'csv', 'csv', 'one_liner',
      async ctx => csv(exportOneLinerCsv(extractWorkflowData(ctx.ast).scenes)), 'export.done.oneliner.csv'),
    report(t, 'shotlist-docx', 'shotlist', 'docx', 'docx', 'shot_list',
      ctx => exportShotListDocx(extractWorkflowData(ctx.ast).scenes), 'export.done.shotlist.docx'),
    report(t, 'shotlist-csv', 'shotlist', 'csv', 'csv', 'shot_list',
      async ctx => csv(exportShotListCsv(extractWorkflowData(ctx.ast).scenes)), 'export.done.shotlist.csv'),
    report(t, 'cast-docx', 'cast', 'docx', 'docx', 'cast_report',
      ctx => exportCastReportDocx(extractWorkflowData(ctx.ast).characters), 'export.done.cast.docx'),
    report(t, 'cast-csv', 'cast', 'csv', 'csv', 'cast_report',
      async ctx => csv(exportCastReportCsv(extractWorkflowData(ctx.ast).characters)), 'export.done.cast.csv'),
  ]
}
