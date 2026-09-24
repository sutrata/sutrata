import React, { useEffect, useState } from 'react'
import { useDocument } from '@sutrata/editor'
import {
  getAIConfig,
  saveAIConfig,
  fetchProviders,
  getApiKey,
  setApiKey,
  deleteApiKey,
  testConnection,
  listModels,
  ProviderConfig,
  ModelConfig,
  AIConfig,
} from './ai-client'

/**
 * "Intelligence & Voice" section of the editor's Settings dialog, contributed
 * through the editor's PanelRegistry (location 'settings'): provider, model,
 * and API key for the bring-your-own-key AIProvider.
 */
export function AISettingsSection({ openSetup }: { openSetup: () => void }) {
  const { setSettingsVisible } = useDocument()

  const [aiConfig, setAiConfig] = useState<AIConfig>(getAIConfig())
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [activeKey, setActiveKey] = useState<string>('')
  const [showKey, setShowKey] = useState<boolean>(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState<string>('')
  const [dynamicModels, setDynamicModels] = useState<ModelConfig[] | null>(null)
  const [modelsLoading, setModelsLoading] = useState<boolean>(false)

  useEffect(() => {
    void loadProviders()
  }, [])

  const loadProviders = async () => {
    const p = await fetchProviders(aiConfig)
    setProviders(p)
  }

  // Loads the stored key for the selected provider, then refreshes its
  // model list from the provider's live /models endpoint (falls back to the
  // static list on any error — see listModels). Depends on `providers` too
  // so it re-runs once fetchProviders() resolves on mount, instead of
  // racing it.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setTestStatus('idle')
      setTestError('')
      const key = await getApiKey(aiConfig.preferredProvider)
      if (cancelled) return
      setActiveKey(key || '')
      setDynamicModels(null)

      const provider = providers.find(p => p.id === aiConfig.preferredProvider)
      if (key && provider) {
        setModelsLoading(true)
        const models = await listModels(provider, key)
        if (!cancelled) {
          setDynamicModels(models)
          setModelsLoading(false)
        }
      }
    }
    void run()
    return () => { cancelled = true }
  }, [aiConfig.preferredProvider, providers])

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
        const provider = providers.find(p => p.id === aiConfig.preferredProvider)
        if (provider) {
          setModelsLoading(true)
          setDynamicModels(await listModels(provider, activeKey.trim()))
          setModelsLoading(false)
        }
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
  const models = dynamicModels ?? currentProvider?.models ?? []

  return (
    <>
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
          Preferred Model{modelsLoading ? ' (refreshing...)' : ''}
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
            setSettingsVisible(false)
            openSetup()
          }}
        >
          Open Setup Wizard
        </button>
      </div>
    </>
  )
}
