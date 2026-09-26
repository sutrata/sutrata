import React, { useState, useEffect, useRef } from 'react'
import { getAIConfig, saveAIConfig, ModelConfig } from './ai-client'
import { ProviderSettings } from './ProviderSettings'
import './ai-settings.css'
import { SparklesIcon } from './SparklesIcon'

interface Props {
  onClose: () => void
}

export function OnboardingDialog({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'intro' | 'keys' | 'custom'>('intro')
  // Custom provider state
  const [customId, setCustomId] = useState('')
  const [customName, setCustomName] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customModels, setCustomModels] = useState('')

  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  const handleAddCustomProvider = () => {
    if (!customId || !customName || !customBaseUrl) {
      alert('Please fill out the provider ID, name and base URL.')
      return
    }
    const modelsList: ModelConfig[] = customModels.split(',').map(m => {
      const parts = m.trim().split(':')
      const id = parts[0]?.trim() || ''
      const name = parts[1]?.trim() || id
      return { id, name }
    }).filter(m => m.id)

    const newCustom = {
      id: customId.trim().toLowerCase(),
      name: customName.trim(),
      baseUrl: customBaseUrl.trim().replace(/\/+$/, ''),
      ...(modelsList.length ? { models: modelsList } : {}),
    }

    const current = getAIConfig()
    const customProviders = [...current.customProviders]
    const index = customProviders.findIndex(p => p.id === newCustom.id)
    if (index >= 0) {
      customProviders[index] = newCustom
    } else {
      customProviders.push(newCustom)
    }
    const updated = { ...current, customProviders }

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
              <ProviderSettings />

              <div className="cs-dialog-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <button
                  type="button"
                  className="cs-ai-btn-ghost"
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
                An API key is optional for these, and models are listed from the endpoint when it supports it.
              </p>
              {!window.desktopAPI && (
                <p className="cs-onboarding-desc" style={{ fontSize: '12px' }}>
                  In the browser, the server must allow this page's origin ({window.location.origin}) —
                  for Ollama, start it with <code>OLLAMA_ORIGINS={window.location.origin}</code>.
                  The desktop app doesn't need this.
                </p>
              )}

              <div className="cs-ai-form">
                <div className="cs-ai-field">
                  <label className="cs-ai-label" htmlFor="cs-ob-custom-id">Provider ID (e.g. ollama)</label>
                  <input
                    id="cs-ob-custom-id"
                    type="text"
                    className="cs-ai-input"
                    value={customId}
                    onChange={e => setCustomId(e.target.value)}
                    placeholder="ollama"
                  />
                </div>
                <div className="cs-ai-field">
                  <label className="cs-ai-label" htmlFor="cs-ob-custom-name">Display name</label>
                  <input
                    id="cs-ob-custom-name"
                    type="text"
                    className="cs-ai-input"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Local Ollama"
                  />
                </div>
                <div className="cs-ai-field">
                  <label className="cs-ai-label" htmlFor="cs-ob-custom-url">Base URL</label>
                  <input
                    id="cs-ob-custom-url"
                    type="text"
                    className="cs-ai-input"
                    value={customBaseUrl}
                    onChange={e => setCustomBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                  />
                </div>
                <div className="cs-ai-field">
                  <label className="cs-ai-label" htmlFor="cs-ob-custom-models">Models (optional — id:name, comma-separated; used if the endpoint can't list its models)</label>
                  <input
                    id="cs-ob-custom-models"
                    type="text"
                    className="cs-ai-input"
                    value={customModels}
                    onChange={e => setCustomModels(e.target.value)}
                    placeholder="llama3:Llama 3, mistral:Mistral 7B"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <button
                  type="button"
                  className="cs-ai-btn-secondary"
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
