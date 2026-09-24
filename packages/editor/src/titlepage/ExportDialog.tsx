import { useState, useEffect, useMemo } from 'react'
import { useDocument } from '../context/DocumentContext'
import { parse, romanizeSutra } from '@sutrata/parser'
import type { RomanizeVariant } from '@sutrata/parser'
import { useTranslation } from '../i18n/useTranslation'
import { allStyles } from '../styles/registry'
import { useExportRegistry } from '../extensions/export-registry'
import type { ExportContribution, ExportContext } from '../extensions/export-registry'
import { useRegistryList, withBuiltins } from '../extensions/registry-store'
import { builtinExporters } from '../file/builtin-exporters'

/**
 * Renders every export format from one list: the editor's built-ins
 * (file/builtin-exporters.ts) plus the embedder's ExportRegistry entries.
 * Screenplay formats are cards; reports are grouped by `family` with chips.
 */
export function ExportDialog() {
  const { ast, text, filePath, setExportVisible, resolvedStyle, customStyles, showToast } = useDocument()
  const { t } = useTranslation()
  const registered = useRegistryList(useExportRegistry())
  const exporters = useMemo(() => withBuiltins(builtinExporters(t), registered), [t, registered])
  const screenplayFormats = exporters.filter(e => e.group === 'screenplay')
  const reportFormats = exporters.filter(e => e.group === 'report')
  const reportFamilies = useMemo(() => {
    const families = new Map<string, ExportContribution[]>()
    for (const e of reportFormats) families.set(e.family ?? e.label, [...(families.get(e.family ?? e.label) ?? []), e])
    return [...families]
  }, [reportFormats])

  const [tab, setTab] = useState<'screenplay' | 'reports'>('screenplay')
  const [formatId, setFormatId] = useState<string>(screenplayFormats[0]?.id ?? '')
  const [warnings, setWarnings] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [styleOverride, setStyleOverride] = useState('')
  const [romanizeScope, setRomanizeScope] = useState<'off' | 'all' | 'dialogue'>('off')
  const [romanizeVariant, setRomanizeVariant] = useState<RomanizeVariant>('strict')
  const [romanizeReports, setRomanizeReports] = useState(false)
  const [skipNotes, setSkipNotes] = useState(false)
  const hasIndicText = /[\u0900-\u0DFF]/.test(text)
  const styleChoices = allStyles(customStyles)
  const selected = exporters.find(e => e.id === formatId) ?? screenplayFormats[0]
  const showStylePicker = tab === 'screenplay' && !!selected?.supports?.style
  const showSkipNotes = tab === 'screenplay' && !!selected?.supports?.skipNotes
  const showRomanize = tab === 'screenplay' && hasIndicText && !!selected?.supports?.romanize
  const showReportRomanize = hasIndicText && reportFormats.some(e => e.supports?.romanize)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportVisible(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setExportVisible])

  const baseName = (filePath ?? 'screenplay').replace(/\.[^.]+$/, '')

  /** The context an exporter runs with: the document, or a romanized copy
   *  (Indic → ISO 15919, export only; the .sutra text is never changed). */
  function exportContext(exporter: ExportContribution): ExportContext {
    const romanizeScopeFor = !exporter.supports?.romanize || !hasIndicText ? null
      : exporter.group === 'report' ? (romanizeReports ? 'all' as const : null)
      : romanizeScope === 'off' ? null : romanizeScope
    const options = {
      styleId: exporter.group === 'screenplay' ? styleOverride || undefined : undefined,
      skipNotes: exporter.group === 'screenplay' && skipNotes,
      romanized: romanizeScopeFor ? { scope: romanizeScopeFor, variant: romanizeVariant } : null,
    }
    if (!romanizeScopeFor) return { text, ast, style: resolvedStyle, customStyles, options, baseName }
    const romanized = romanizeSutra(text, {
      scope: romanizeScopeFor, variant: romanizeVariant, ...(exporter.group === 'report' ? { notice: false } : {}),
    })
    return { text: romanized, ast: parse(romanized), style: resolvedStyle, customStyles, options, baseName }
  }

  async function doExport() {
    if (!selected) return
    setIsExporting(true)
    try {
      const ctx = exportContext(selected)
      // Called before any await: print previews must open inside the click.
      const output = await selected.run(ctx)
      const blob = output instanceof Blob ? output : output?.blob
      setWarnings(output && !(output instanceof Blob) ? output.warnings ?? [] : [])
      if (blob) downloadBlob(selected.fileName(ctx), blob)
      showToast(selected.successMessage ?? `Exported ${selected.label}`, blob ? 'success' : 'info')
    } catch (err) {
      console.error('Export failed', err)
      setWarnings(['An error occurred during export. Please check the console.'])
      showToast('Export failed. Check console for details.', 'error')
    } finally {
      setIsExporting(false)
    }
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
                if (selected?.group !== 'screenplay') setFormatId(screenplayFormats[0]?.id ?? '')
              }}
            >
              Screenplay Formats
            </button>
            {reportFormats.length > 0 && <button
              type="button"
              role="tab"
              aria-selected={tab === 'reports'}
              className={`cs-export-seg-btn${tab === 'reports' ? ' cs-export-seg-btn-active' : ''}`}
              onClick={() => {
                setTab('reports')
                if (selected?.group !== 'report') setFormatId(reportFormats[0]?.id ?? '')
              }}
            >
              Production Reports
            </button>}
          </div>

          {tab === 'screenplay' ? (
            <div>
              <div className="cs-export-card-grid">
                {screenplayFormats.map(f => (
                  <div
                    key={f.id}
                    className={`cs-export-format-card${selected?.id === f.id ? ' cs-export-format-card-selected' : ''}`}
                    onClick={() => setFormatId(f.id)}
                    role="radio"
                    aria-checked={selected?.id === f.id}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFormatId(f.id) }}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={f.id}
                      checked={selected?.id === f.id}
                      onChange={() => setFormatId(f.id)}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '13px', display: 'block', color: 'var(--cs-ui-text-light-primary, #1c1b18)' }}>
                        {f.label}
                      </strong>
                      {f.description && (
                        <span style={{ fontSize: '11px', color: 'var(--cs-ui-text-light-secondary, #59574f)' }}>
                          {f.description}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
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

              {showSkipNotes && (
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

              {showRomanize && (
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
              {reportFamilies.map(([family, formats]) => (
                <div key={family} className="cs-export-report-box">
                  <div className="cs-export-report-header">
                    <span className="cs-export-report-title">{family}</span>
                    <div className="cs-export-chips">
                      {formats.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          className={`cs-export-chip${selected?.id === f.id ? ' cs-export-chip-active' : ''}`}
                          onClick={() => setFormatId(f.id)}
                        >
                          {f.formatLabel ?? f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {formats[0]!.description && (
                    <div style={{ fontSize: '11px', color: 'var(--cs-ui-text-light-secondary, #59574f)' }}>
                      {formats[0]!.description}
                    </div>
                  )}
                </div>
              ))}

              {showReportRomanize && (
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
          <button type="button" className="cs-confirm-btn-primary" onClick={doExport} disabled={isExporting || !selected}>
            {isExporting ? 'Exporting...' : t('export.download')}
          </button>
        </div>
      </div>
    </div>
  )
}
