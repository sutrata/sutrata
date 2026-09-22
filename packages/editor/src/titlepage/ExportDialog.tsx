import { useState, useEffect } from 'react'
import { useDocument } from '../context/DocumentContext'
import { exportFountain, parse, romanizeSutra } from '@sutra/parser'
import type { DocumentNode, RomanizeVariant } from '@sutra/parser'
import { useTranslation } from '../i18n/useTranslation'
import { exportToDocx } from '../file/docx-exporter'
import {
  extractWorkflowData,
  exportOneLinerCsv,
  exportShotListCsv,
  exportCastReportCsv,
  exportOneLinerDocx,
  exportShotListDocx,
  exportCastReportDocx,
  openPrintPreview,
  openScreenplayPrintPreview,
} from '../file/workflow-reports'
import { allStyles } from '../styles/registry'

type ExportFormat =
  | 'fountain'
  | 'docx'
  | 'pdf'
  | 'oneliner-print'
  | 'oneliner-docx'
  | 'oneliner-csv'
  | 'shotlist-docx'
  | 'shotlist-csv'
  | 'cast-docx'
  | 'cast-csv'

export function ExportDialog() {
  const { ast, text, filePath, setExportVisible, resolvedStyle, customStyles, showToast } = useDocument()
  const { t } = useTranslation()
  const [tab, setTab] = useState<'screenplay' | 'reports'>('screenplay')
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [warnings, setWarnings] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [styleOverride, setStyleOverride] = useState('')
  const [romanizeScope, setRomanizeScope] = useState<'off' | 'all' | 'dialogue'>('off')
  const [romanizeVariant, setRomanizeVariant] = useState<RomanizeVariant>('strict')
  const [romanizeReports, setRomanizeReports] = useState(false)
  const [skipNotes, setSkipNotes] = useState(false)
  const hasIndicText = /[\u0900-\u0DFF]/.test(text)
  const styleChoices = allStyles(customStyles)
  const showStylePicker = tab === 'screenplay' && (format === 'docx' || format === 'pdf')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportVisible(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setExportVisible])

  const baseName = (filePath ?? 'screenplay').replace(/\.[^.]+$/, '')

  /** The AST handed to the PDF/DOCX exporters: the document itself, or a romanized copy
   *  (Indic → ISO 15919, export only; the .sutra text is never changed). */
  function screenplayAst(): { doc: DocumentNode; suffix: string } {
    if (romanizeScope === 'off' || !hasIndicText) return { doc: ast, suffix: '' }
    const romanized = romanizeSutra(text, { scope: romanizeScope, variant: romanizeVariant })
    return { doc: parse(romanized), suffix: '_romanized' }
  }

  /** Workflow-report data, from a fully romanized copy when that option is on. */
  function reportData(): { data: ReturnType<typeof extractWorkflowData>; suffix: string } {
    if (!romanizeReports || !hasIndicText) return { data: extractWorkflowData(ast), suffix: '' }
    const romanized = romanizeSutra(text, { scope: 'all', variant: romanizeVariant, notice: false })
    return { data: extractWorkflowData(parse(romanized)), suffix: '_romanized' }
  }

  async function doExport() {
    setIsExporting(true)
    try {
      const { data, suffix: reportSuffix } = reportData()
      const reportTitleSuffix = reportSuffix ? ' (ROMANIZED)' : ''

      if (format === 'fountain') {
        const result = exportFountain(ast)
        setWarnings(result.warnings)
        download(`${baseName}.fountain`, result.text, 'text/plain')
        showToast('Exported Fountain screenplay', 'success')
      } else if (format === 'docx') {
        setWarnings([])
        const { doc, suffix } = screenplayAst()
        const blob = await exportToDocx(doc, styleOverride || undefined, customStyles, skipNotes)
        downloadBlob(`${baseName}${suffix}.docx`, blob)
        showToast('Exported Word document (.docx)', 'success')
      } else if (format === 'pdf') {
        setWarnings([])
        const { doc, suffix } = screenplayAst()
        const title = `${baseName.toUpperCase()} - SCREENPLAY${suffix ? ' (ROMANIZED)' : ''}`
        await openScreenplayPrintPreview(doc, title, styleOverride || undefined, customStyles, skipNotes)
        showToast('Opened Screenplay Print Preview', 'info')
      } else if (format === 'oneliner-print') {
        setWarnings([])
        await openPrintPreview(data.scenes, `${baseName.toUpperCase()} - ONE-LINER SCHEDULE${reportTitleSuffix}`)
        showToast('Opened One-Liner Schedule', 'info')
      } else if (format === 'oneliner-docx') {
        setWarnings([])
        const blob = await exportOneLinerDocx(data.scenes)
        downloadBlob(`${baseName}_one_liner${reportSuffix}.docx`, blob)
        showToast('Exported One-Liner DOCX', 'success')
      } else if (format === 'oneliner-csv') {
        setWarnings([])
        const csv = exportOneLinerCsv(data.scenes)
        download(`${baseName}_one_liner${reportSuffix}.csv`, csv, 'text/csv')
        showToast('Exported One-Liner CSV', 'success')
      } else if (format === 'shotlist-docx') {
        setWarnings([])
        const blob = await exportShotListDocx(data.scenes)
        downloadBlob(`${baseName}_shot_list${reportSuffix}.docx`, blob)
        showToast('Exported Shot List DOCX', 'success')
      } else if (format === 'shotlist-csv') {
        setWarnings([])
        const csv = exportShotListCsv(data.scenes)
        download(`${baseName}_shot_list${reportSuffix}.csv`, csv, 'text/csv')
        showToast('Exported Shot List CSV', 'success')
      } else if (format === 'cast-docx') {
        setWarnings([])
        const blob = await exportCastReportDocx(data.characters)
        downloadBlob(`${baseName}_cast_report${reportSuffix}.docx`, blob)
        showToast('Exported Cast Report DOCX', 'success')
      } else if (format === 'cast-csv') {
        setWarnings([])
        const csv = exportCastReportCsv(data.characters)
        download(`${baseName}_cast_report${reportSuffix}.csv`, csv, 'text/csv')
        showToast('Exported Cast Report CSV', 'success')
      }
    } catch (err) {
      console.error('Export failed', err)
      setWarnings(['An error occurred during export. Please check the console.'])
      showToast('Export failed. Check console for details.', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  function download(filename: string, content: string, mimeType: string) {
    const data = mimeType === 'text/csv' ? ['\uFEFF', content] : [content]
    const blob = new Blob(data, { type: `${mimeType};charset=utf-8` })
    downloadBlob(filename, blob)
  }

  function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="cs-export-overlay"
      role="presentation"
      onClick={e => {
        if (e.target === e.currentTarget) setExportVisible(false)
      }}
    >
      <div className="cs-export-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-export-title" style={{ maxHeight: '90vh', maxWidth: '540px', width: '92%', display: 'flex', flexDirection: 'column' }}>
        <div className="cs-panel-header">
          <span id="cs-export-title" className="cs-panel-title">{t('export.title')}</span>
          <button className="cs-panel-close" onClick={() => setExportVisible(false)} aria-label="Close">
            ×
          </button>
        </div>

        <div className="cs-panel-body" style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
          {/* Top Segmented Tabs: Screenplay vs Production Reports */}
          <div className="cs-export-segmented" role="tablist" aria-label="Export category">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'screenplay'}
              className={`cs-export-seg-btn${tab === 'screenplay' ? ' cs-export-seg-btn-active' : ''}`}
              onClick={() => {
                setTab('screenplay')
                if (!['fountain', 'docx', 'pdf'].includes(format)) setFormat('pdf')
              }}
            >
              Screenplay Formats
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'reports'}
              className={`cs-export-seg-btn${tab === 'reports' ? ' cs-export-seg-btn-active' : ''}`}
              onClick={() => {
                setTab('reports')
                if (['fountain', 'docx', 'pdf'].includes(format)) setFormat('oneliner-print')
              }}
            >
              Production Reports
            </button>
          </div>

          {tab === 'screenplay' ? (
            <div>
              <div className="cs-export-card-grid">
                {/* PDF / Print */}
                <div
                  className={`cs-export-format-card${format === 'pdf' ? ' cs-export-format-card-selected' : ''}`}
                  onClick={() => setFormat('pdf')}
                  role="radio"
                  aria-checked={format === 'pdf'}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFormat('pdf') }}
                >
                  <input
                    type="radio"
                    name="format"
                    value="pdf"
                    checked={format === 'pdf'}
                    onChange={() => setFormat('pdf')}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', color: 'var(--cs-ui-text-light-primary, #1c1b18)' }}>
                      PDF / Print Preview
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--cs-ui-text-light-secondary, #59574f)' }}>
                      Print-ready industry screenplay layout styled according to your active visual template.
                    </span>
                  </div>
                </div>

                {/* Microsoft Word */}
                <div
                  className={`cs-export-format-card${format === 'docx' ? ' cs-export-format-card-selected' : ''}`}
                  onClick={() => setFormat('docx')}
                  role="radio"
                  aria-checked={format === 'docx'}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFormat('docx') }}
                >
                  <input
                    type="radio"
                    name="format"
                    value="docx"
                    checked={format === 'docx'}
                    onChange={() => setFormat('docx')}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', color: 'var(--cs-ui-text-light-primary, #1c1b18)' }}>
                      Microsoft Word (.docx)
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--cs-ui-text-light-secondary, #59574f)' }}>
                      {t('export.docxDesc')}
                    </span>
                  </div>
                </div>

                {/* Fountain */}
                <div
                  className={`cs-export-format-card${format === 'fountain' ? ' cs-export-format-card-selected' : ''}`}
                  onClick={() => setFormat('fountain')}
                  role="radio"
                  aria-checked={format === 'fountain'}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFormat('fountain') }}
                >
                  <input
                    type="radio"
                    name="format"
                    value="fountain"
                    checked={format === 'fountain'}
                    onChange={() => setFormat('fountain')}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', color: 'var(--cs-ui-text-light-primary, #1c1b18)' }}>
                      Fountain (.fountain)
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--cs-ui-text-light-secondary, #59574f)' }}>
                      {t('export.fountainDesc')}
                    </span>
                  </div>
                </div>
              </div>

              {showStylePicker && (
                <div className="cs-settings-row" style={{ marginTop: '14px', padding: '10px', background: 'var(--cs-ui-bg-panel-subtle, #f4f2ea)', borderRadius: '6px' }}>
                  <label className="cs-settings-label" htmlFor="cs-export-style-select" style={{ fontSize: '12px' }}>
                    {t('export.style')}
                  </label>
                  <select
                    id="cs-export-style-select"
                    className="cs-settings-select"
                    value={styleOverride}
                    onChange={e => setStyleOverride(e.target.value)}
                  >
                    <option value="">{t('export.styleDefault')} ({resolvedStyle.name})</option>
                    {styleChoices.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {showStylePicker && (
                <div className="cs-settings-row" style={{ marginTop: '8px', padding: '10px', background: 'var(--cs-ui-bg-panel-subtle, #f4f2ea)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    id="cs-export-skip-notes"
                    type="checkbox"
                    checked={skipNotes}
                    onChange={e => setSkipNotes(e.target.checked)}
                  />
                  <label htmlFor="cs-export-skip-notes" className="cs-settings-label" style={{ fontSize: '12px', margin: 0 }}>
                    Skip notes ([[ ]])
                  </label>
                </div>
              )}

              {showStylePicker && hasIndicText && (
                <div className="cs-settings-row" style={{ marginTop: '8px', padding: '10px', background: 'var(--cs-ui-bg-panel-subtle, #f4f2ea)', borderRadius: '6px', flexWrap: 'wrap', gap: '8px' }}>
                  <label className="cs-settings-label" htmlFor="cs-export-romanize-select" style={{ fontSize: '12px' }}>
                    Romanized copy (ISO 15919)
                  </label>
                  <select
                    id="cs-export-romanize-select"
                    className="cs-settings-select"
                    value={romanizeScope}
                    onChange={e => setRomanizeScope(e.target.value as 'off' | 'all' | 'dialogue')}
                  >
                    <option value="off">Off (native script)</option>
                    <option value="all">All text</option>
                    <option value="dialogue">Dialogue only</option>
                  </select>
                  {romanizeScope !== 'off' && (
                    <select
                      aria-label="Romanization variant"
                      className="cs-settings-select"
                      value={romanizeVariant}
                      onChange={e => setRomanizeVariant(e.target.value as RomanizeVariant)}
                    >
                      <option value="strict">Strict ISO 15919</option>
                      <option value="colloquial">Casual (no diacritics)</option>
                    </select>
                  )}
                  {romanizeScope !== 'off' && (
                    <span style={{ fontSize: '11px', color: 'var(--cs-ui-text-light-secondary, #59574f)', flexBasis: '100%' }}>
                      Your script is not changed. Page numbers in the romanized copy differ from the original.
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* One-Liner Box */}
              <div className="cs-export-report-box">
                <div className="cs-export-report-header">
                  <span className="cs-export-report-title">One-Liner Schedule</span>
                  <div className="cs-export-chips">
                    <button
                      type="button"
                      className={`cs-export-chip${format === 'oneliner-print' ? ' cs-export-chip-active' : ''}`}
                      onClick={() => setFormat('oneliner-print')}
                    >
                      Print View
                    </button>
                    <button
                      type="button"
                      className={`cs-export-chip${format === 'oneliner-docx' ? ' cs-export-chip-active' : ''}`}
                      onClick={() => setFormat('oneliner-docx')}
                    >
                      Word (.docx)
                    </button>
                    <button
                      type="button"
                      className={`cs-export-chip${format === 'oneliner-csv' ? ' cs-export-chip-active' : ''}`}
                      onClick={() => setFormat('oneliner-csv')}
                    >
                      Spreadsheet (.csv)
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--cs-ui-text-light-secondary, #59574f)' }}>
                  A scene-by-scene production stripboard breakdown with locations, cast, and timings.
                </div>
              </div>

              {/* Shot List Box */}
              <div className="cs-export-report-box">
                <div className="cs-export-report-header">
                  <span className="cs-export-report-title">Shot List</span>
                  <div className="cs-export-chips">
                    <button
                      type="button"
                      className={`cs-export-chip${format === 'shotlist-docx' ? ' cs-export-chip-active' : ''}`}
                      onClick={() => setFormat('shotlist-docx')}
                    >
                      Word (.docx)
                    </button>
                    <button
                      type="button"
                      className={`cs-export-chip${format === 'shotlist-csv' ? ' cs-export-chip-active' : ''}`}
                      onClick={() => setFormat('shotlist-csv')}
                    >
                      Spreadsheet (.csv)
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--cs-ui-text-light-secondary, #59574f)' }}>
                  Camera shot specifications extracted from scene headings and production notes.
                </div>
              </div>

              {/* Cast Breakdown Box */}
              <div className="cs-export-report-box">
                <div className="cs-export-report-header">
                  <span className="cs-export-report-title">Cast Breakdown</span>
                  <div className="cs-export-chips">
                    <button
                      type="button"
                      className={`cs-export-chip${format === 'cast-docx' ? ' cs-export-chip-active' : ''}`}
                      onClick={() => setFormat('cast-docx')}
                    >
                      Word (.docx)
                    </button>
                    <button
                      type="button"
                      className={`cs-export-chip${format === 'cast-csv' ? ' cs-export-chip-active' : ''}`}
                      onClick={() => setFormat('cast-csv')}
                    >
                      Spreadsheet (.csv)
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--cs-ui-text-light-secondary, #59574f)' }}>
                  Character occurrences, dialogue counts, and assigned actors list.
                </div>
              </div>

              {hasIndicText && (
                <div className="cs-settings-row" style={{ marginTop: '8px', padding: '10px', background: 'var(--cs-ui-bg-panel-subtle, #f4f2ea)', borderRadius: '6px', flexWrap: 'wrap', gap: '8px' }}>
                  <label className="cs-settings-label" htmlFor="cs-export-romanize-reports" style={{ fontSize: '12px' }}>
                    Romanized copy (ISO 15919)
                  </label>
                  <select
                    id="cs-export-romanize-reports"
                    className="cs-settings-select"
                    value={romanizeReports ? 'on' : 'off'}
                    onChange={e => setRomanizeReports(e.target.value === 'on')}
                  >
                    <option value="off">Off (native script)</option>
                    <option value="on">Romanize all text</option>
                  </select>
                  {romanizeReports && (
                    <select
                      aria-label="Romanization variant"
                      className="cs-settings-select"
                      value={romanizeVariant}
                      onChange={e => setRomanizeVariant(e.target.value as RomanizeVariant)}
                    >
                      <option value="strict">Strict ISO 15919</option>
                      <option value="colloquial">Casual (no diacritics)</option>
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="cs-export-warnings" style={{ background: '#fffbeb', border: '1px solid #fcd34d', padding: '10px', borderRadius: '4px', marginTop: '14px' }}>
              <div className="cs-export-warn-title" style={{ fontWeight: 600, color: '#b45309', fontSize: '12px', marginBottom: '4px' }}>
                {t('export.warnings')}
              </div>
              {warnings.map((w, i) => (
                <div key={i} className="cs-export-warn-item" style={{ fontSize: '11px', color: '#59574f' }}>
                  • {w}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cs-export-actions" style={{ borderTop: '1px solid var(--cs-ui-border-light-subtle, #eeece4)', padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--cs-ui-bg-panel-subtle, #f4f2ea)' }}>
          <button type="button" className="cs-confirm-btn-cancel" onClick={() => setExportVisible(false)}>
            {t('export.cancel')}
          </button>
          <button type="button" className="cs-confirm-btn-primary" onClick={doExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : t('export.download')}
          </button>
        </div>
      </div>
    </div>
  )
}
