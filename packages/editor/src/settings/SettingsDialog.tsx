import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { useDocument } from '../context/DocumentContext'
import {
  getAIConfig,
  saveAIConfig,
  fetchProviders,
  getApiKey,
  setApiKey,
  deleteApiKey,
  testConnection,
  ProviderConfig,
  AIConfig,
} from '../ai/ai-client'

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
  const { setAIOnboardingVisible } = useDocument()
  const dialogRef = useRef<HTMLDivElement>(null)

  // AI states
  const [aiConfig, setAiConfig] = useState<AIConfig>(getAIConfig())
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [activeKey, setActiveKey] = useState<string>('')
  const [showKey, setShowKey] = useState<boolean>(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState<string>('')

  useEffect(() => {
    dialogRef.current?.focus()
    void loadProviders()
  }, [])

  const loadProviders = async () => {
    const p = await fetchProviders(aiConfig)
    setProviders(p)
  }

  useEffect(() => {
    void loadKeyForProvider(aiConfig.preferredProvider)
  }, [aiConfig.preferredProvider])

  const loadKeyForProvider = async (pid: string) => {
    setTestStatus('idle')
    setTestError('')
    const key = await getApiKey(pid)
    setActiveKey(key || '')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextProvider = e.target.value
    const provider = providers.find(p => p.id === nextProvider)
    const nextModel = provider?.models[0]?.id || ''

    const updated = {
      ...aiConfig,
      preferredProvider: nextProvider,
      preferredModel: nextModel,
    }
    setAiConfig(updated)
    saveAIConfig(updated)
  }

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const updated = {
      ...aiConfig,
      preferredModel: e.target.value,
    }
    setAiConfig(updated)
    saveAIConfig(updated)
  }

  const handleKeyChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setActiveKey(val)
    if (val.trim()) {
      await setApiKey(aiConfig.preferredProvider, val.trim())
    } else {
      await deleteApiKey(aiConfig.preferredProvider)
    }
    setTestStatus('idle')
  }

  const handleTestKey = async () => {
    if (!activeKey.trim()) {
      setTestStatus('error')
      setTestError('Please enter an API key to test.')
      return
    }
    setTestStatus('testing')
    setTestError('')
    try {
      const ok = await testConnection(aiConfig.preferredProvider, activeKey.trim(), aiConfig)
      if (ok) {
        setTestStatus('success')
      } else {
        setTestStatus('error')
        setTestError('Connection failed: empty or invalid response.')
      }
    } catch (err: any) {
      setTestStatus('error')
      setTestError(err.message || String(err))
    }
  }

  const currentProvider = providers.find(p => p.id === aiConfig.preferredProvider)
  const models = currentProvider?.models || []

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

          <div style={{ margin: '14px 0 6px 0', borderTop: '1px solid var(--cs-ui-border-light, #e8e8e4)', paddingTop: '14px' }} className="cs-settings-section-label">
            Intelligence &amp; Voice Settings
          </div>

          <div className="cs-settings-row">
            <label className="cs-settings-label" htmlFor="cs-ai-provider-select">
              Preferred Provider
            </label>
            <select
              id="cs-ai-provider-select"
              className="cs-settings-select"
              value={aiConfig.preferredProvider}
              onChange={handleProviderChange}
            >
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="cs-settings-row">
            <label className="cs-settings-label" htmlFor="cs-ai-model-select">
              Preferred Model
            </label>
            <select
              id="cs-ai-model-select"
              className="cs-settings-select"
              value={aiConfig.preferredModel}
              onChange={handleModelChange}
              disabled={models.length === 0}
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="cs-settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <label className="cs-settings-label" htmlFor="cs-ai-key-input">
                API Key for {currentProvider?.name || aiConfig.preferredProvider}
              </label>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--cs-ui-accent, #c4760a)', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="cs-ai-key-input"
              type={showKey ? 'text' : 'password'}
              style={{
                width: '100%',
                padding: '7px 10px',
                border: '1px solid var(--cs-ui-border-light, #ccc)',
                borderRadius: '4px',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
              value={activeKey}
              onChange={handleKeyChange}
              placeholder={`Enter API Key for ${aiConfig.preferredProvider}`}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className="cs-voice-btn-secondary"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={handleTestKey}
                disabled={testStatus === 'testing'}
              >
                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            {testStatus === 'success' && (
              <span style={{ color: '#10b981', fontSize: '12px', marginTop: '2px' }}>
                ✓ Key verified! Connection succeeded.
              </span>
            )}
            {testStatus === 'error' && (
              <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '2px', whiteSpace: 'pre-wrap' }}>
                ✗ Error: {testError}
              </span>
            )}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              className="cs-voice-btn-primary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => {
                onClose()
                setAIOnboardingVisible(true)
              }}
            >
              Open Setup Wizard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
