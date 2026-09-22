import React, { useState, useEffect, useRef } from 'react'
import { useDocument } from '../context/DocumentContext'
import { voiceServiceInstance } from './voice-service'
import { getApiKey, getAIConfig, callAI } from './ai-client'
import { VOICE_FORMAT_SYSTEM_PROMPT } from './prompts'
import { insertSutra } from '../editor/insert-helper'
import { VoiceConfirmDialog } from './VoiceConfirmDialog'
import { LOCALIZED_COMMANDS } from './commands'
import { useTranslation } from '../i18n/useTranslation'
import { MicIcon } from '../shell/icons'

const VOICE_LANGUAGES = [
  { code: 'en-US', label: 'English (US)', base: 'en' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', base: 'hi' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)', base: 'ta' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)', base: 'te' },
  { code: 'ml-IN', label: 'മലയാളം (Malayalam)', base: 'ml' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)', base: 'kn' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)', base: 'bn' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)', base: 'gu' },
  { code: 'mr-IN', label: 'मराठी (Marathi)', base: 'mr' },
]

export function VoiceToolbar() {
  const { mode, setVoiceActive, setAIOnboardingVisible, showToast } = useDocument()
  const { locale } = useTranslation()
  const defaultLang = VOICE_LANGUAGES.find(l => l.base === locale)?.code || 'en-US'
  const [langCode, setLangCode] = useState<string>(defaultLang)
  const [isListening, setIsListening] = useState<boolean>(false)
  const [transcript, setTranscript] = useState<string>('')
  const [interimResult, setInterimResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [showConfirm, setShowConfirm] = useState<boolean>(false)
  const [isFormatting, setIsFormatting] = useState<boolean>(false)

  useEffect(() => {
    const matched = VOICE_LANGUAGES.find(l => l.base === locale)?.code || 'en-US'
    setLangCode(matched)
  }, [locale])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isSupported = voiceServiceInstance.isSupported()

  // Audio waveform animation
  useEffect(() => {
    if (!isListening) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let phase = 0

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#d97706'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.beginPath()

      const width = canvas.width
      const height = canvas.height
      const midY = height / 2

      ctx.moveTo(0, midY)
      for (let x = 0; x < width; x++) {
        const angle = (x / width) * Math.PI * 4 + phase
        const amp = Math.sin(phase * 1.8) * (height / 2.6) * Math.sin((x / width) * Math.PI)
        const y = midY + Math.sin(angle) * amp
        ctx.lineTo(x, y)
      }
      ctx.stroke()

      phase += 0.08
      animationId = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(animationId)
  }, [isListening])

  const performFormatting = async (fullTranscript: string) => {
    const alwaysAuto = localStorage.getItem('sutrata_always_auto_insert') === 'true'
    if (alwaysAuto) {
      setIsFormatting(true)
      try {
        const config = getAIConfig()
        const prompt = `Raw Voice Transcript (${langCode}):\n"${fullTranscript}"`
        const result = await callAI(prompt, VOICE_FORMAT_SYSTEM_PROMPT, config)
        insertSutra(result.trim(), mode)
        setVoiceActive(false)
        showToast('Voice dictation inserted.', 'success')
      } catch (e: any) {
        showToast(`Auto-insert failed: ${e.message || String(e)}. Opening confirmation dialog.`, 'warn')
        setShowConfirm(true)
      } finally {
        setIsFormatting(false)
      }
    } else {
      setShowConfirm(true)
    }
  }

  const handleStart = async () => {
    const key = (await getApiKey('gemini')) || (await getApiKey('groq')) || (await getApiKey('anthropic'))
    if (!key) {
      showToast('AI keys are required to format dictated text. Opening Setup...', 'info')
      setAIOnboardingVisible(true)
      return
    }

    setError('')
    setInterimResult('')
    setIsListening(true)

    voiceServiceInstance.start(langCode, {
      onResult: (text, isFinal) => {
        if (isFinal) {
          setTranscript(prev => (prev ? prev + ' ' + text : text))
          setInterimResult('')
        } else {
          setInterimResult(text)
        }
      },
      onError: (err) => {
        if (err === 'network') {
          setError('Web Speech API requires an active network connection to transcribe speech.')
        } else {
          setError(err)
        }
        setIsListening(false)
      },
      onEnd: () => {
        setIsListening(false)
      },
    })
  }

  const handleStopListening = async () => {
    voiceServiceInstance.stop()
    setIsListening(false)

    const fullTranscript = (transcript + ' ' + interimResult).trim()
    if (fullTranscript) {
      setTranscript(fullTranscript)
      await performFormatting(fullTranscript)
    }
    setInterimResult('')
  }

  const handleFormatCaptured = async () => {
    const fullTranscript = transcript.trim()
    if (!fullTranscript) return
    await performFormatting(fullTranscript)
  }

  const handleCancel = () => {
    voiceServiceInstance.abort()
    setIsListening(false)
    setVoiceActive(false)
  }

  const handleConfirmResult = (formattedText: string) => {
    insertSutra(formattedText, mode)
    setShowConfirm(false)
    setVoiceActive(false)
    showToast('Screenplay formatted and inserted.', 'success')
  }

  const activeBaseLang = VOICE_LANGUAGES.find(l => l.code === langCode)?.base || 'en'
  const cheatsheet = LOCALIZED_COMMANDS[activeBaseLang] || LOCALIZED_COMMANDS.en!

  if (showConfirm) {
    const fullTranscript = (transcript + ' ' + interimResult).trim()
    return (
      <VoiceConfirmDialog
        rawTranscript={fullTranscript}
        langCode={langCode}
        onConfirm={handleConfirmResult}
        onCancel={() => {
          setShowConfirm(false)
          setVoiceActive(false)
        }}
      />
    )
  }

  return (
    <div className="cs-voice-toolbar" role="region" aria-label="Voice Dictation Toolbar">
      <div className="cs-voice-toolbar-row">
        <div className="cs-voice-toolbar-badge">
          <MicIcon size={14} />
          <span>Voice Dictation</span>
        </div>

        <select
          className="cs-voice-select"
          value={langCode}
          onChange={e => setLangCode(e.target.value)}
          disabled={isListening}
          aria-label="Voice Language"
        >
          {VOICE_LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>

        {isListening ? (
          <div className="cs-voice-listening-group">
            <button
              type="button"
              className="cs-voice-btn-danger"
              onClick={handleStopListening}
            >
              Stop &amp; Format
            </button>
            <canvas
              ref={canvasRef}
              width={110}
              height={26}
              className="cs-voice-waveform"
              role="img"
              aria-label="Audio waveform visualization"
            />
          </div>
        ) : (
          <div className="cs-voice-actions-group">
            <button
              type="button"
              className="cs-voice-btn-primary"
              onClick={handleStart}
              disabled={!isSupported || isFormatting}
            >
              <MicIcon size={14} />
              <span>{isFormatting ? 'Formatting...' : 'Start Dictation'}</span>
            </button>

            {transcript && (
              <>
                <button
                  type="button"
                  className="cs-voice-btn-secondary"
                  onClick={handleFormatCaptured}
                  disabled={isFormatting}
                >
                  Re-format
                </button>
                <button
                  type="button"
                  className="cs-voice-btn-ghost"
                  onClick={() => {
                    setTranscript('')
                    setError('')
                  }}
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          className="cs-voice-btn-ghost"
          onClick={handleCancel}
        >
          Close
        </button>

        {!isSupported && (
          <span className="cs-voice-warning">
            Web Speech API is not supported in this browser.
          </span>
        )}
      </div>

      {/* Real-time transcript display / editable area */}
      {(isListening || transcript || interimResult) && (
        isListening ? (
          <div className="cs-voice-transcript-box">
            {transcript}
            {interimResult && <span className="cs-voice-interim"> {interimResult}</span>}
            {!transcript && !interimResult && <span className="cs-voice-placeholder">Speak now to dictate...</span>}
          </div>
        ) : (
          <textarea
            className="cs-voice-textarea"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Edit captured text before formatting..."
            rows={2}
          />
        )
      )}

      {error && (
        <div className="cs-voice-error" role="alert">
          {error}
        </div>
      )}

      {/* Localized formatting cheatsheet */}
      <div className="cs-voice-cheatsheet">
        <span className="cs-voice-cheatsheet-title">Commands:</span>
        {cheatsheet.map(c => {
          if (c.type === 'literal') return null
          return (
            <span key={c.type} className="cs-voice-tag">
              <span className="cs-voice-tag-type">{c.type}</span>: &ldquo;{c.keywords[0]}&rdquo;
            </span>
          )
        })}
        <span className="cs-voice-tag cs-voice-tag-bypass">
          bypass format: &ldquo;literal [text]&rdquo;
        </span>
      </div>
    </div>
  )
}
