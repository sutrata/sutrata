import React, { useState, useEffect } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { useDocument } from '../context/DocumentContext'
import { insertSutra } from './insert-helper'
import { VoiceConfirmDialog } from '../ai/VoiceConfirmDialog'
import { SparklesIcon } from '../shell/icons'
import { useAI } from '../extensions/ai-provider'

const VOICE_LANG_MAP: Record<string, string> = {
  en: 'en-US',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  kn: 'kn-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  mr: 'mr-IN',
}

function isSelectionInEditor(sel: Selection): boolean {
  if (sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)
  let node: Node | null = range.commonAncestorContainer
  while (node) {
    if (node instanceof HTMLElement) {
      if (node.classList.contains('ProseMirror') || node.classList.contains('cm-content')) {
        return true
      }
    }
    node = node.parentNode
  }
  return false
}

export function SelectionMenu() {
  const { currentLanguage } = useLanguage()
  const { mode } = useDocument()
  const ai = useAI()
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [selectedText, setSelectedText] = useState<string>('')
  const [showConfirm, setShowConfirm] = useState<boolean>(false)

  useEffect(() => {
    const handleSelectionChange = () => {
      if (showConfirm) return

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !isSelectionInEditor(sel)) {
        setMenuPosition(null)
        setSelectedText('')
        return
      }

      const text = sel.toString().trim()
      if (!text) {
        setMenuPosition(null)
        setSelectedText('')
        return
      }

      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      setMenuPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      })
      setSelectedText(sel.toString())
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [showConfirm])

  const handleCut = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    document.execCommand('cut')
    setMenuPosition(null)
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    document.execCommand('copy')
    setMenuPosition(null)
  }

  const handleFormat = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowConfirm(true)
    setMenuPosition(null)
  }

  if (showConfirm && ai) {
    const langCode = VOICE_LANG_MAP[currentLanguage] || 'en-US'
    return (
      <VoiceConfirmDialog
        rawTranscript={selectedText}
        langCode={langCode}
        onConfirm={(formattedText) => {
          insertSutra(formattedText, mode)
          setShowConfirm(false)
        }}
        onCancel={() => {
          setShowConfirm(false)
        }}
      />
    )
  }

  if (!menuPosition) return null

  return (
    <div
      className="cs-selection-menu"
      style={{
        left: `${menuPosition.x}px`,
        top: `${menuPosition.y}px`,
      }}
      role="toolbar"
      aria-label="Text Selection Actions"
    >
      {ai && (
        <>
          <button
            type="button"
            className="cs-selection-btn cs-selection-btn-format"
            onClick={handleFormat}
            title="Format selected text using AI"
          >
            <SparklesIcon size={12} />
            <span>Format</span>
          </button>
          <div className="cs-selection-sep" />
        </>
      )}
      <button
        type="button"
        className="cs-selection-btn"
        onClick={handleCut}
      >
        Cut
      </button>
      <button
        type="button"
        className="cs-selection-btn"
        onClick={handleCopy}
      >
        Copy
      </button>
    </div>
  )
}
