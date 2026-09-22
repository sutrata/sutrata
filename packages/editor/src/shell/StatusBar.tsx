import React, { useMemo, useState, useEffect } from 'react'
import { useDocument } from '../context/DocumentContext'
import { LanguageStatus } from './LanguageStatus'
import { buildSceneList } from '../navigator/scene-list'
import { StatisticsDialog } from '../navigator/StatisticsDialog'
import { VersionHistory } from './VersionHistory'
import { StatsIcon, HistoryIcon } from './icons'
import { subscribeToAICalls, formatActiveCalls } from '../ai/ai-client'
import { useTranslation } from '../i18n/useTranslation'

function AIStatusBarStatus() {
  const [activeCalls, setActiveCalls] = useState<{ providerName: string; model: string }[]>([])

  useEffect(() => {
    return subscribeToAICalls(setActiveCalls)
  }, [])

  if (activeCalls.length === 0) return null

  return (
    <div
      className="cs-ai-status-indicator"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--cs-ui-accent, #c4760a)',
        fontWeight: 600,
        fontSize: '11px',
        marginRight: '8px',
      }}
    >
      <span className="cs-spinner" style={{ width: '10px', height: '10px', borderWidth: '1.5px' }} />
      <span>{formatActiveCalls(activeCalls)}</span>
    </div>
  )
}

export function StatusBar() {
  const { text, isDirty, lastSaveTarget, filePath, versions, versionHistoryVisible, setVersionHistoryVisible, restoreVersion, clearVersionHistory } = useDocument()
  const { t } = useTranslation()
  const [statsOpen, setStatsOpen] = useState(false)

  // Three states, not two: "saved" meant different guarantees depending on
  // whether the content ever reached a real file vs. only this browser's
  // local autosave backup — say so explicitly instead of a single "saved".
  const saveLabel = isDirty
    ? t('statusbar.unsavedChanges')
    : lastSaveTarget === 'file' ? t('statusbar.savedToFile')
    : lastSaveTarget === 'local' ? t('statusbar.savedLocally')
    : t('statusbar.allChangesSaved')
  const saveTooltip = isDirty
    ? undefined
    : lastSaveTarget === 'file' ? t('statusbar.savedToFileTooltip')
    : lastSaveTarget === 'local' ? t('statusbar.savedLocallyTooltip')
    : undefined

  const scenes = useMemo(() => buildSceneList(text), [text])

  const { wordCount, pageEstimate } = useMemo(() => {
    const trimmed = text.trim()
    const words = trimmed ? trimmed.split(/\s+/).length : 0
    // Standard screenplay rule: ~54 lines or ~200-250 words per page
    const lines = text.split('\n').length
    const estPages = Math.max(1, Math.round(lines / 54))
    return { wordCount: words, pageEstimate: estPages }
  }, [text])

  return (
    <>
      <footer className="cs-status-bar" role="contentinfo" aria-label="Status bar">
        <div className="cs-sb-left">
          <span className="cs-sb-metric" title={t('statusbar.scenesTooltip')}>
            <strong>{scenes.length}</strong> {scenes.length === 1 ? t('statusbar.scene') : t('statusbar.scenes')}
          </span>
          <span className="cs-sb-sep">•</span>
          <span className="cs-sb-metric" title={t('statusbar.pagesTooltip')}>
            <strong>~{pageEstimate}</strong> {pageEstimate === 1 ? t('statusbar.page') : t('statusbar.pages')}
          </span>
          <span className="cs-sb-sep">•</span>
          <span className="cs-sb-metric" title={t('statusbar.wordsTooltip')}>
            <strong>{wordCount.toLocaleString()}</strong> {t('statusbar.words')}
          </span>
        </div>

        <div className="cs-sb-center">
          <div className="cs-sb-save" role="status" aria-live="polite" title={saveTooltip}>
            <span className={`cs-sb-dot ${isDirty ? 'cs-sb-dot-dirty' : 'cs-sb-dot-clean'}`} />
            <span className={isDirty ? 'cs-sb-save-dirty' : 'cs-sb-save-clean'}>
              {saveLabel}
            </span>
          </div>
        </div>

        <div className="cs-sb-right">
          <AIStatusBarStatus />
          {filePath && versions.length > 0 && (
            <button
              type="button"
              className="cs-nav-action-btn"
              onClick={() => setVersionHistoryVisible(true)}
              title={`${versions.length} version${versions.length === 1 ? '' : 's'} saved`}
              style={{ fontSize: '11px', gap: '4px', padding: '2px 6px' }}
            >
              <HistoryIcon size={13} />
              <span>{versions.length}</span>
            </button>
          )}
          <button
            type="button"
            className="cs-nav-action-btn"
            onClick={() => setStatsOpen(true)}
            title={t('statusbar.statsTooltip')}
            style={{ fontSize: '11px', gap: '4px', padding: '2px 6px' }}
          >
            <StatsIcon size={13} />
            <span>{t('statusbar.statsButton')}</span>
          </button>
          <LanguageStatus />
        </div>
      </footer>

      {statsOpen && <StatisticsDialog onClose={() => setStatsOpen(false)} />}
      {filePath && (
        <VersionHistory
          versions={versions}
          filePath={filePath}
          onRestore={restoreVersion}
          onClearAll={clearVersionHistory}
          visible={versionHistoryVisible}
          onClose={() => setVersionHistoryVisible(false)}
        />
      )}
    </>
  )
}
