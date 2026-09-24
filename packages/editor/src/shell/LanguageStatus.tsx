import React, { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { useDocument } from '../context/DocumentContext'
import { getEditorView } from '../editor/editor-bus'
import { useCanEdit } from '../extensions/session'

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi (Devanagari)',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  bn: 'Bengali',
  gu: 'Gujarati',
  pa: 'Gurmukhi',
  or: 'Odia',
  si: 'Sinhala',
}

export function LanguageStatus() {
  const { currentLanguage } = useLanguage()
  const { text, setText } = useDocument()
  const canEdit = useCanEdit()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const langName = LANG_NAMES[currentLanguage] ?? currentLanguage

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const handleSelectLanguage = (code: string) => {
    if (!canEdit) { setMenuOpen(false); return }
    const view = getEditorView()
    if (view) {
      const { state, dispatch } = view
      const { from, to } = state.selection
      const tagText = `{lang=${code}}`
      dispatch(state.tr.insertText(tagText, from, to))
      view.focus()
    } else {
      setText(text + `\n{lang=${code}}`)
    }
    setMenuOpen(false)
  }

  return (
    <div className="cs-lang-status" ref={menuRef}>
      <button
        type="button"
        className="cs-lang-status-btn cs-lang-pill"
        title={`Script language at caret: ${langName} (${currentLanguage.toUpperCase()})`}
        aria-label={`Script language: ${langName}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span className="cs-lang-pill-script">अ/A</span>
        <span className="cs-lang-code">{currentLanguage.toUpperCase()}</span>
      </button>

      {menuOpen && (
        <div className="cs-lang-menu" role="menu" aria-label="Script languages">
          {Object.entries(LANG_NAMES).map(([code, name]) => {
            const isActive = currentLanguage === code
            return (
              <button
                type="button"
                key={code}
                role="menuitem"
                className={`cs-lang-option${isActive ? ' cs-lang-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelectLanguage(code)
                }}
              >
                <span>{name}</span>
                <span className="cs-lang-code" style={{ fontSize: '10px', opacity: 0.7 }}>
                  {code.toUpperCase()}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
