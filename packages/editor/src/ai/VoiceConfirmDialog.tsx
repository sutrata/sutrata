import React, { useState, useEffect } from 'react'
import { callAI, getAIConfig } from './ai-client'
import { VOICE_FORMAT_SYSTEM_PROMPT } from './prompts'
import { SparklesIcon } from '../shell/icons'

interface Props {
  rawTranscript: string
  langCode: string
  onConfirm: (formattedText: string) => void
  onCancel: () => void
}

export function VoiceConfirmDialog({ rawTranscript, langCode, onConfirm, onCancel }: Props) {
  const [formattedText, setFormattedText] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [alwaysAutoInsert, setAlwaysAutoInsert] = useState<boolean>(
    localStorage.getItem('sutrata_always_auto_insert') === 'true'
  )

  useEffect(() => {
    void formatTranscript()
  }, [rawTranscript])

  const formatTranscript = async () => {
    setIsLoading(true)
    setError('')
    try {
      const config = getAIConfig()
      const prompt = `Raw Voice Transcript (${langCode}):\n"${rawTranscript}"`
      const result = await callAI(prompt, VOICE_FORMAT_SYSTEM_PROMPT, config)
      setFormattedText(result.trim())
    } catch (e: any) {
      console.error('AI formatting failed:', e)
      setError(e.message || String(e))
      setFormattedText(rawTranscript)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = () => {
    localStorage.setItem('sutrata_always_auto_insert', alwaysAutoInsert ? 'true' : 'false')
    onConfirm(formattedText)
  }

  return (
    <div className="cs-dialog-overlay" onClick={onCancel} style={{ zIndex: 310 }}>
      <div
        className="cs-dialog cs-voice-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm Voice Dictation Formatting"
        onClick={e => e.stopPropagation()}
      >
        <div className="cs-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SparklesIcon size={16} />
            <span className="cs-dialog-title">Review Voice Formatting</span>
          </div>
          <button
            type="button"
            className="cs-fr-close"
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="cs-voice-confirm-body">
          {isLoading ? (
            <div className="cs-voice-loading-state">
              <div className="cs-spinner" style={{ width: '28px', height: '28px', borderWidth: '2.5px' }} />
              <span style={{ fontSize: '13px', color: 'var(--cs-ui-text-dark-secondary, #a8a69d)' }}>
                Formatting speech into Sutra screenplay format...
              </span>
            </div>
          ) : (
            <>
              {error && (
                <div className="cs-voice-error" role="alert">
                  AI formatting notice: {error} (showing raw input below)
                </div>
              )}

              <div className="cs-voice-grid">
                <div className="cs-voice-column">
                  <span className="cs-voice-col-title">Raw Dictation</span>
                  <div className="cs-voice-box-raw">{rawTranscript}</div>
                </div>

                <div className="cs-voice-column">
                  <span className="cs-voice-col-title">Formatted Sutra</span>
                  <textarea
                    className="cs-voice-box-formatted"
                    value={formattedText}
                    onChange={e => setFormattedText(e.target.value)}
                    rows={8}
                  />
                </div>
              </div>

              <div className="cs-voice-options">
                <label className="cs-voice-checkbox-label">
                  <input
                    type="checkbox"
                    checked={alwaysAutoInsert}
                    onChange={e => setAlwaysAutoInsert(e.target.checked)}
                  />
                  <span>Always auto-insert directly into screenplay (skip review)</span>
                </label>
              </div>

              <div className="cs-dialog-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="cs-voice-btn-ghost"
                  onClick={onCancel}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className="cs-voice-btn-primary"
                  onClick={handleConfirm}
                >
                  Insert Into Screenplay
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
