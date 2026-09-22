import React, { useEffect, useRef, useState } from 'react'
import { useDocument } from '../context/DocumentContext'
import { useTranslation } from '../i18n/useTranslation'
import { allStyles } from './registry'
import { isBuiltinStyleId } from './builtin-styles'
import { validateStyleJson } from './validate'
import { useStorageAdapter } from '../extensions/storage-adapter'
import type { ScreenplayStyleDefinition } from './types'

interface Props {
  onClose: () => void
}

export function StyleDialog({ onClose }: Props) {
  const { resolvedStyle, customStyles, setDocumentStyle, reloadCustomStyles } = useDocument()
  const { t } = useTranslation()
  const storageAdapter = useStorageAdapter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  async function handleImport() {
    setError(null)
    const picked = await storageAdapter.openStyleJson()
    if (!picked) return

    let data: unknown
    try {
      data = JSON.parse(picked.text)
    } catch {
      setError(`${t('style.importInvalid')}: not valid JSON`)
      return
    }

    const result = validateStyleJson(data)
    if (!result.ok) {
      setError(`${t('style.importInvalid')}: ${result.errors.join('; ')}`)
      return
    }

    if (isBuiltinStyleId(result.style.id)) {
      setError(t('style.importIdReserved'))
      return
    }
    if (customStyles.some(s => s.id === result.style.id) && !confirm(t('style.importOverwriteConfirm'))) {
      return
    }

    await storageAdapter.saveStyle(result.style)
    await reloadCustomStyles()
  }

  async function handleDelete(id: string) {
    if (!confirm(t('style.deleteConfirm'))) return
    await storageAdapter.deleteStyle(id)
    await reloadCustomStyles()
  }

  function renderRow(style: ScreenplayStyleDefinition, deletable: boolean) {
    const active = style.id === resolvedStyle.id
    const swatchColor = style.elements.sceneHeading.color ? `#${style.elements.sceneHeading.color}` : '#999'
    return (
      <div
        key={style.id}
        className="cs-settings-row"
        style={{ alignItems: 'flex-start', cursor: 'pointer', padding: '6px 0' }}
        onClick={() => setDocumentStyle(style.id)}
      >
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: swatchColor, flexShrink: 0, marginTop: '4px' }} />
          <div>
            <div className="cs-settings-label" style={{ fontWeight: active ? 600 : 400 }}>
              {style.name}
              {active && <span style={{ color: '#1976d2', fontWeight: 600 }}> — {t('style.current')}</span>}
            </div>
            {style.description && (
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{style.description}</div>
            )}
          </div>
        </div>
        {deletable && (
          <button
            className="cs-panel-close"
            aria-label={t('style.delete')}
            onClick={e => { e.stopPropagation(); void handleDelete(style.id) }}
          >
            ×
          </button>
        )}
      </div>
    )
  }

  const builtins = allStyles([]).filter(s => isBuiltinStyleId(s.id))

  return (
    <div className="cs-dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="cs-dialog cs-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('style.title')}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="cs-dialog-header">
          <span className="cs-dialog-title">{t('style.title')}</span>
          <button className="cs-fr-close" aria-label={t('style.close')} onClick={onClose}>×</button>
        </div>

        <div className="cs-settings-body">
          {error && (
            <div className="cs-export-warnings" style={{ marginTop: 0 }}>
              <div className="cs-export-warn-item">{error}</div>
            </div>
          )}

          <div className="cs-settings-section-label">{t('style.builtIn')}</div>
          {builtins.map(s => renderRow(s, false))}

          {customStyles.length > 0 && (
            <>
              <div className="cs-settings-section-label" style={{ marginTop: '8px' }}>{t('style.custom')}</div>
              {customStyles.map(s => renderRow(s, true))}
            </>
          )}

          <button
            className="cs-export-btn-cancel"
            style={{ marginTop: '8px', alignSelf: 'flex-start' }}
            onClick={() => { void handleImport() }}
          >
            {t('style.import')}
          </button>
        </div>
      </div>
    </div>
  )
}
