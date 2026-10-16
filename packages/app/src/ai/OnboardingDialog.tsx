import React, { useState, useEffect, useRef } from 'react'
import { CustomEndpoints } from './CustomEndpoints'
import { ProviderSettings } from './ProviderSettings'
import './ai-settings.css'
import { SparklesIcon } from './SparklesIcon'

interface Props {
  onClose: () => void
}

export function OnboardingDialog({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'intro' | 'keys' | 'custom'>('intro')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

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

          {activeTab === 'custom' && <CustomEndpoints onGoToKeys={() => setActiveTab('keys')} />}
        </div>
      </div>
    </div>
  )
}
