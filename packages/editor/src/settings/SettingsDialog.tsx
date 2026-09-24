import React, { useEffect, useRef } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { usePanels } from '../extensions/panel-registry'
import { usePanelContext } from '../shell/use-panel-context'

const UI_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'mr', label: 'मराठी' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
  { code: 'si', label: 'සිංහල' },
]

interface Props {
  onClose: () => void
}

export function SettingsDialog({ onClose }: Props) {
  const { t, locale, setLocale } = useTranslation()
  const panelContext = usePanelContext()
  // Embedder sections (e.g. the OSS app's AI provider & key settings) — the
  // editor itself has no provider-specific settings.
  const sections = usePanels('settings')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="cs-dialog-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="cs-dialog cs-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{ maxWidth: '480px' }}
      >
        <div className="cs-dialog-header">
          <span className="cs-dialog-title">{t('settings.title')}</span>
          <button className="cs-fr-close" aria-label={t('settings.close')} onClick={onClose}>×</button>
        </div>

        <div className="cs-settings-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          <div className="cs-settings-section-label">{t('settings.general')}</div>

          <div className="cs-settings-row">
            <label className="cs-settings-label" htmlFor="cs-ui-lang-select">
              {t('settings.uiLanguage')}
            </label>
            <select
              id="cs-ui-lang-select"
              className="cs-settings-select"
              value={locale}
              onChange={e => setLocale(e.target.value)}
            >
              {UI_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>

          {sections.map(section => (
            <section key={section.id} className="cs-settings-section" aria-label={section.title}>
              <div
                style={{ margin: '14px 0 6px 0', borderTop: '1px solid var(--cs-ui-border-light, #e8e8e4)', paddingTop: '14px' }}
                className="cs-settings-section-label"
              >
                {section.title}
              </div>
              {section.render(panelContext)}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
