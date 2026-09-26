import { useEffect, useState } from 'react'
import {
  getAIConfig,
  saveAIConfig,
  getProviders,
  getApiKey,
  setApiKey,
  deleteApiKey,
  listModels,
  testConnection,
  isKeyOptional,
  AIConfig,
  ModelConfig,
} from './ai-client'
import { ProviderCombobox } from './ProviderCombobox'
import './ai-settings.css'

type ModelsState =
  | { status: 'no-key' }
  | { status: 'loading' }
  | { status: 'ok'; models: ModelConfig[]; fetchedAt: number }
  | { status: 'error'; error: string }

/**
 * Active provider, its API key and its model — shared by the Settings
 * section and the setup wizard. Every change is saved immediately, built on
 * the stored config so the two never overwrite each other's changes.
 *
 * Models are listed live from the provider (cached 24h, see listModels); the
 * chosen model is never replaced automatically. If it's missing from a list
 * that loaded, a warning asks the user to pick another.
 */
export function ProviderSettings() {
  const [config, setConfig] = useState<AIConfig>(getAIConfig)
  const [key, setKey] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<ModelsState>({ status: 'no-key' })
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  const providers = getProviders(config)
  const provider = providers.find(p => p.id === config.activeProvider)
  const model = config.modelByProvider[config.activeProvider] ?? ''
  const keyOptional = isKeyOptional(config, config.activeProvider)

  const updateConfig = (change: (current: AIConfig) => AIConfig) => {
    const updated = change(getAIConfig())
    setConfig(updated)
    saveAIConfig(updated)
  }

  const loadModels = async (apiKey: string, refresh: boolean) => {
    if (!provider) return
    if (!apiKey && !keyOptional) {
      setModels({ status: 'no-key' })
      return
    }
    setModels({ status: 'loading' })
    const result = await listModels(provider, apiKey, { refresh })
    // Ignore a result that arrives after the user switched providers.
    if (getAIConfig().activeProvider !== provider.id) return
    setModels(result.ok
      ? { status: 'ok', models: result.models, fetchedAt: result.fetchedAt }
      : { status: 'error', error: result.error })
  }

  useEffect(() => {
    let cancelled = false
    setTestStatus('idle')
    setModels({ status: 'no-key' })
    void getApiKey(config.activeProvider).then(stored => {
      if (cancelled) return
      setKey(stored ?? '')
      setSavedKey(stored ?? '')
      void loadModels(stored ?? '', false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.activeProvider])

  const saveKey = async () => {
    const trimmed = key.trim()
    if (trimmed === savedKey) return
    if (trimmed) await setApiKey(config.activeProvider, trimmed)
    else await deleteApiKey(config.activeProvider)
    setSavedKey(trimmed)
    setTestStatus('idle')
    await loadModels(trimmed, false)
  }

  const selectModel = (id: string) => {
    updateConfig(c => ({ ...c, modelByProvider: { ...c.modelByProvider, [c.activeProvider]: id } }))
  }

  const handleTest = async () => {
    if (!provider) return
    await saveKey()
    if (!key.trim() && !keyOptional) {
      setTestStatus('error')
      setTestError('Enter an API key to test.')
      return
    }
    setTestStatus('testing')
    setTestError('')
    try {
      await testConnection(provider, key.trim(), model || undefined)
      setTestStatus('success')
    } catch (e: any) {
      setTestStatus('error')
      setTestError(e.message || String(e))
    }
  }

  // Providers the user has set up (a chosen model, or a custom endpoint) are
  // listed first in the picker.
  const pinnedIds = new Set([
    config.activeProvider,
    ...Object.keys(config.modelByProvider),
    ...config.customProviders.map(p => p.id),
  ])

  // When the live listing fails, a custom endpoint's configured models are
  // offered instead; otherwise the model id is typed in.
  const offered = models.status === 'ok' ? models.models
    : models.status === 'error' && provider?.models?.length ? provider.models
    : null
  const modelMissing = models.status === 'ok' && !!model && !models.models.some(m => m.id === model)

  return (
    <div className="cs-ai-form">
      <div className="cs-ai-field">
        <label className="cs-ai-label" htmlFor="cs-ai-provider-select">Provider</label>
        <ProviderCombobox
          id="cs-ai-provider-select"
          providers={providers}
          pinnedIds={pinnedIds}
          value={config.activeProvider}
          onChange={id => updateConfig(c => ({ ...c, activeProvider: id }))}
        />
      </div>

      <div className="cs-ai-field">
        <div className="cs-ai-field-head">
          <label className="cs-ai-label" htmlFor="cs-ai-key-input">
            API Key for {provider?.name ?? config.activeProvider}{keyOptional ? ' (optional)' : ''}
          </label>
          <button type="button" className="cs-ai-link" onClick={() => setShowKey(!showKey)}>
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <input
          id="cs-ai-key-input"
          type={showKey ? 'text' : 'password'}
          className="cs-ai-input is-mono"
          value={key}
          onChange={e => setKey(e.target.value)}
          onBlur={() => void saveKey()}
          onKeyDown={e => { if (e.key === 'Enter') void saveKey() }}
          placeholder={keyOptional
            ? 'Leave empty for a local server that needs no key'
            : `Enter API key for ${provider?.name ?? config.activeProvider}`}
        />
      </div>

      <div className="cs-ai-field">
        <div className="cs-ai-field-head">
          <label className="cs-ai-label" htmlFor="cs-ai-model-select">
            Model{models.status === 'loading' ? ' (loading…)' : ''}
          </label>
          {(savedKey || keyOptional) && (
            <button
              type="button"
              className="cs-ai-link"
              onClick={() => void loadModels(savedKey, true)}
              disabled={models.status === 'loading'}
            >
              Refresh models
            </button>
          )}
        </div>

        {offered ? (
          <select
            id="cs-ai-model-select"
            className="cs-ai-select"
            value={model}
            onChange={e => selectModel(e.target.value)}
          >
            {!model && <option value="" disabled>Choose a model…</option>}
            {model && !offered.some(m => m.id === model) && (
              <option value={model}>{model} (not offered by provider)</option>
            )}
            {offered.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        ) : models.status === 'error' ? (
          <input
            id="cs-ai-model-select"
            className="cs-ai-input is-mono"
            defaultValue={model}
            key={config.activeProvider}
            onBlur={e => selectModel(e.target.value.trim())}
            placeholder="Model id, e.g. llama-3.3-70b-versatile"
          />
        ) : (
          <select id="cs-ai-model-select" className="cs-ai-select" disabled value="">
            <option value="">
              {models.status === 'loading' ? 'Loading models…' : 'Enter an API key to load models'}
            </option>
          </select>
        )}

        {models.status === 'error' && (
          <span className="cs-ai-status is-error">Couldn't load the model list: {models.error}</span>
        )}
        {modelMissing && (
          <span className="cs-ai-status is-warn" role="alert">
            ⚠ "{model}" isn't in {provider?.name}'s current model list — it may have been retired. Choose another model.
          </span>
        )}
      </div>

      <div className="cs-ai-actions">
        <button
          type="button"
          className="cs-ai-btn-secondary"
          onClick={() => void handleTest()}
          disabled={testStatus === 'testing'}
        >
          {testStatus === 'testing' ? 'Testing…' : 'Test Connection'}
        </button>
        {testStatus === 'success' && (
          <span className="cs-ai-status is-ok">
            ✓ {model ? `${model} responded.` : 'Key accepted.'}
          </span>
        )}
        {testStatus === 'error' && <span className="cs-ai-status is-error">✗ {testError}</span>}
      </div>
    </div>
  )
}
