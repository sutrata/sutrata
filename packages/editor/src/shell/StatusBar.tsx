import React, { useMemo, useState, useEffect } from 'react'
import { useDocument } from '../context/DocumentContext'
import { LanguageStatus } from './LanguageStatus'
import { buildSceneList } from '../navigator/scene-list'
import { StatisticsDialog } from '../navigator/StatisticsDialog'
import { VersionHistory } from './VersionHistory'
import { StatsIcon, HistoryIcon } from './icons'
import { useTranslation } from '../i18n/useTranslation'
import { useAI, formatActivity } from '../extensions/ai-provider'
import { useCanEdit } from '../extensions/session'
import type { AIActivity } from '../extensions/ai-provider'

function AIStatusBarStatus() {
  const ai = useAI()
  const [activeCalls, setActiveCalls] = useState<AIActivity[]>([])

  useEffect(() => {
    if (!ai?.subscribeActivity) return
    return ai.subscribeActivity(setActiveCalls)
  }, [ai])

  if (!ai || activeCalls.length === 0) return null

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
      <span>{formatActivity(activeCalls)}</span>
    </div>
  )
}

export function StatusBar() {
  const { text, isDirty, lastSaveTarget, filePath, versions, versionHistoryVisible, setVersionHistoryVisible, restoreVersion, clearVersionHistory } = useDocument()
  const { t } = useTranslation()
  const canEdit = useCanEdit()
  const [statsOpen, setStatsOpen] = useState(false)

  // VS Code-style: a local autosave backs the content up but never counts as
  // "saved" in the main label — only a real write to the file (saveFile/
  // saveFileAs, which clears isDirty) does. While still dirty, the tooltip
  // says whether that local backup has caught up with the latest edits yet.
  const saveLabel = isDirty
    ? t('statusbar.unsavedChanges')
    : lastSaveTarget === 'file' ? t('statusbar.savedToFile')
    : t('statusbar.allChangesSaved')
  const saveTooltip = isDirty
    ? lastSaveTarget === 'local' ? t('statusbar.savedLocallyTooltip') : undefined
    : lastSaveTarget === 'file' ? t('statusbar.savedToFileTooltip')
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
          <span className="cs-sb-metric cs-sb-metric-scenes" title={t('statusbar.scenesTooltip')}>
            <strong>{scenes.length}</strong> <span className="cs-sb-metric-label">{scenes.length === 1 ? t('statusbar.scene') : t('statusbar.scenes')}</span>
          </span>
          <span className="cs-sb-sep">•</span>
          <span className="cs-sb-metric cs-sb-metric-pages" title={t('statusbar.pagesTooltip')}>
            <strong>~{pageEstimate}</strong> <span className="cs-sb-metric-label">{pageEstimate === 1 ? t('statusbar.page') : t('statusbar.pages')}</span>
          </span>
          <span className="cs-sb-sep cs-sb-words-sep">•</span>
          <span className="cs-sb-metric cs-sb-metric-words" title={t('statusbar.wordsTooltip')}>
            <strong>{wordCount.toLocaleString()}</strong> <span className="cs-sb-metric-label">{t('statusbar.words')}</span>
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
          {canEdit && filePath && versions.length > 0 && (
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
      {canEdit && filePath && (
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
