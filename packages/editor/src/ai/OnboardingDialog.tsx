import React, { useState, useEffect, useRef } from 'react'
import {
  getApiKey, setApiKey, deleteApiKey, getAIConfig, saveAIConfig,
  fetchProviders, testConnection, listModels, AIConfig, ProviderConfig
} from './ai-client'
import { SparklesIcon } from '../shell/icons'

interface Props {
  onClose: () => void
}

export function OnboardingDialog({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'intro' | 'keys' | 'custom'>('intro')
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [providerId, setProviderId] = useState<string>('anthropic')
  const [keyInput, setKeyInput] = useState<string>('')
  const [showKey, setShowKey] = useState<boolean>(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState<string>('')
  const [config, setConfig] = useState<AIConfig>(getAIConfig)

  // Custom provider state
  const [customId, setCustomId] = useState('')
  const [customName, setCustomName] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customModels, setCustomModels] = useState('')

  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void fetchProviders(config).then(setProviders)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.customProviders])

  useEffect(() => {
    dialogRef.current?.focus()
    void loadKeyForProvider(providerId)
  }, [providerId])

  const loadKeyForProvider = async (pid: string) => {
    setTestStatus('idle')
    setTestError('')
    const key = await getApiKey(pid)
    setKeyInput(key || '')
  }

  const handleTestKey = async () => {
    if (!keyInput.trim()) {
      setTestStatus('error')
      setTestError('Please enter an API key to test.')
      return
    }
    setTestStatus('testing')
    setTestError('')
    try {
      const ok = await testConnection(providerId, keyInput.trim(), config)
      if (ok) {
        setTestStatus('success')
      } else {
        setTestStatus('error')
        setTestError('Connection failed: empty or invalid response from endpoint.')
      }
    } catch (e: any) {
      setTestStatus('error')
      setTestError(e.message || String(e))
    }
  }

  const handleSaveKey = async () => {
    const trimmed = keyInput.trim()
    if (trimmed) {
      await setApiKey(providerId, trimmed)

      const provider = providers.find(p => p.id === providerId)
      let preferredModel = provider?.models[0]?.id || ''
      if (provider) {
        const liveModels = await listModels(provider, trimmed)
        preferredModel = liveModels[0]?.id || preferredModel
      }

      const updated = { ...config, preferredProvider: providerId, preferredModel }
      setConfig(updated)
      saveAIConfig(updated)
      setTestStatus('success')
    } else {
      await deleteApiKey(providerId)
      setTestStatus('idle')
    }
  }

  const handleAddCustomProvider = () => {
    if (!customId || !customName || !customBaseUrl || !customModels) {
      alert('Please fill out all custom provider fields.')
      return
    }
    const modelsList = customModels.split(',').map(m => {
      const parts = m.trim().split(':')
      const id = parts[0]?.trim() || ''
      const name = parts[1]?.trim() || id
      return { id, name }
    }).filter(m => m.id)

    const newCustom = {
      id: customId.trim().toLowerCase(),
      name: customName.trim(),
      baseUrl: customBaseUrl.trim(),
      models: modelsList,
    }

    const updated = { ...config }
    const index = updated.customProviders.findIndex(p => p.id === newCustom.id)
    if (index >= 0) {
      updated.customProviders[index] = newCustom
    } else {
      updated.customProviders.push(newCustom)
    }

    setConfig(updated)
    saveAIConfig(updated)
    setCustomId('')
    setCustomName('')
    setCustomBaseUrl('')
    setCustomModels('')
    alert(`Custom provider "${newCustom.name}" added. You can now configure its key in the API Keys tab.`)
  }

  const handleFinish = () => {
    localStorage.setItem('sutrata_onboarding_completed', 'true')
    onClose()
  }

  return (
    <div className="cs-dialog-overlay" onClick={onClose} style={{ zIndex: 300 }}>
      <div
        ref={dialogRef}
        className="cs-dialog cs-onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Intelligence Setup"
        onClick={e => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="cs-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SparklesIcon size={16} />
            <span className="cs-dialog-title">Intelligence &amp; Dictation Setup</span>
          </div>
          <button
            type="button"
            className="cs-fr-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tab Selection */}
        <div className="cs-tabs-header">
          <button
            type="button"
            className={`cs-tab-btn ${activeTab === 'intro' ? 'active' : ''}`}
            onClick={() => setActiveTab('intro')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`cs-tab-btn ${activeTab === 'keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('keys')}
          >
            API Keys
          </button>
          <button
            type="button"
            className={`cs-tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            Custom Endpoints
          </button>
        </div>

        <div className="cs-onboarding-body">
          {activeTab === 'intro' && (
            <div className="cs-onboarding-section">
              <h3 className="cs-onboarding-h3">Client-Side AI Formatting &amp; Voice</h3>
              <p className="cs-onboarding-desc">
                Sutrata connects directly from your device to high-performance inference APIs.
                Your screenplays and audio transcripts are processed strictly with your own API credentials.
              </p>

              <div className="cs-onboarding-card">
                <div className="cs-onboarding-step">
                  <div className="cs-onboarding-step-num">1</div>
                  <div>
                    <strong>Get a Free-Tier Key:</strong> Obtain a free API key from Google AI Studio (Gemini/Gemma) or Groq (Llama 3.3).
                  </div>
                </div>
                <div className="cs-onboarding-step">
                  <div className="cs-onboarding-step-num">2</div>
                  <div>
                    <strong>Enter Your Key:</strong> Save the key in the API Keys tab. It is encrypted in your local OS keyring or stored securely in your browser session.
                  </div>
                </div>
                <div className="cs-onboarding-step">
                  <div className="cs-onboarding-step-num">3</div>
                  <div>
                    <strong>Start Dictating:</strong> Speak naturally into Sutrata; the formatting engine parses characters, dialogue, and scenes automatically.
                  </div>
                </div>
              </div>

              <div className="cs-dialog-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  className="cs-voice-btn-primary"
                  onClick={() => setActiveTab('keys')}
                >
                  Configure API Keys →
                </button>
              </div>
            </div>
          )}

          {activeTab === 'keys' && (
            <div className="cs-onboarding-section">
              <div className="cs-settings-row" style={{ marginBottom: '12px' }}>
                <label className="cs-settings-label" htmlFor="cs-ob-provider">
                  Active Provider:
                </label>
                <select
                  id="cs-ob-provider"
                  className="cs-settings-select"
                  value={providerId}
                  onChange={e => setProviderId(e.target.value)}
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                <label className="cs-settings-label" htmlFor="cs-ob-key">
                  API Key for {providerId}:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="cs-ob-key"
                    type={showKey ? 'text' : 'password'}
                    className="cs-voice-textarea"
                    style={{ flex: 1, minHeight: '34px', padding: '6px 10px', height: '34px' }}
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    placeholder={`Enter ${providerId} API key...`}
                  />
                  <button
                    type="button"
                    className="cs-voice-btn-ghost"
                    onClick={() => setShowKey(!showKey)}
                    style={{ padding: '0 10px', height: '34px' }}
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                <button
                  type="button"
                  className="cs-voice-btn-primary"
                  onClick={handleSaveKey}
                >
                  Save Key
                </button>
                <button
                  type="button"
                  className="cs-voice-btn-secondary"
                  onClick={handleTestKey}
                  disabled={testStatus === 'testing'}
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </button>
                {testStatus === 'success' && (
                  <span style={{ color: '#10b981', fontSize: '13px', fontWeight: 500 }}>✓ Verified connection</span>
                )}
                {testStatus === 'error' && (
                  <span style={{ color: '#ef4444', fontSize: '12px' }}>{testError}</span>
                )}
              </div>

              <div className="cs-dialog-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <button
                  type="button"
                  className="cs-voice-btn-ghost"
                  onClick={() => setActiveTab('intro')}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="cs-voice-btn-primary"
                  onClick={handleFinish}
                >
                  Done &amp; Close
                </button>
              </div>
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="cs-onboarding-section">
              <p className="cs-onboarding-desc">
                Connect to local OpenAI-compatible endpoints such as Ollama, vLLM, or LM Studio.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label className="cs-settings-label" htmlFor="cs-ob-custom-id">Provider ID (e.g. ollama):</label>
                  <input
                    id="cs-ob-custom-id"
                    type="text"
                    className="cs-voice-textarea"
                    style={{ width: '100%', height: '34px', minHeight: '34px', padding: '6px 10px' }}
                    value={customId}
                    onChange={e => setCustomId(e.target.value)}
                    placeholder="ollama"
                  />
                </div>
                <div>
                  <label className="cs-settings-label" htmlFor="cs-ob-custom-name">Display Name:</label>
                  <input
                    id="cs-ob-custom-name"
                    type="text"
                    className="cs-voice-textarea"
                    style={{ width: '100%', height: '34px', minHeight: '34px', padding: '6px 10px' }}
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Local Ollama"
                  />
                </div>
                <div>
                  <label className="cs-settings-label" htmlFor="cs-ob-custom-url">Base URL:</label>
                  <input
                    id="cs-ob-custom-url"
                    type="text"
                    className="cs-voice-textarea"
                    style={{ width: '100%', height: '34px', minHeight: '34px', padding: '6px 10px' }}
                    value={customBaseUrl}
                    onChange={e => setCustomBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                  />
                </div>
                <div>
                  <label className="cs-settings-label" htmlFor="cs-ob-custom-models">Models (id:name comma-separated):</label>
                  <input
                    id="cs-ob-custom-models"
                    type="text"
                    className="cs-voice-textarea"
                    style={{ width: '100%', height: '34px', minHeight: '34px', padding: '6px 10px' }}
                    value={customModels}
                    onChange={e => setCustomModels(e.target.value)}
                    placeholder="llama3:Llama 3, mistral:Mistral 7B"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                <button
                  type="button"
                  className="cs-voice-btn-secondary"
                  onClick={handleAddCustomProvider}
                >
                  Register Endpoint
                </button>
                <button
                  type="button"
                  className="cs-voice-btn-primary"
                  onClick={() => setActiveTab('keys')}
                >
                  Go to API Keys →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
