import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { SpellcheckIcon } from '../shell/icons'
import { SpellcheckSettings } from './SpellcheckSettings'
import { languageByCode } from './languages'
import { useSpellcheck } from './settings'

/** The status bar's spell check control, after the word count (as in Word): shows the state, opens the options. */
export function SpellcheckStatus() {
  const { t } = useTranslation()
  const { enabled, regional, dictionaries } = useSpellcheck()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const label = !enabled ? t('settings.spellcheck') : regional ? `EN + ${languageByCode(regional)?.label ?? regional}` : 'EN'
  const trouble = enabled && (dictionaries['en'] === 'unavailable' || (regional !== '' && dictionaries[regional] === 'unavailable'))

  return (
    <div className="cs-sb-spell" ref={ref}>
      <button type="button" className={`cs-nav-action-btn cs-sb-spell-btn${enabled ? ' cs-sb-spell-on' : ''}`}
        aria-haspopup="dialog" aria-expanded={open} title={t('settings.spellcheck')}
        aria-label={enabled ? `${t('settings.spellcheck')}: ${label}` : t('settings.spellcheck')}
        onClick={() => setOpen(o => !o)}>
        <SpellcheckIcon size={14} checked={enabled && !trouble} />
        <span>{label}</span>
      </button>
      {open && (
        <div className="cs-sb-spell-pop" role="dialog" aria-label={t('settings.spellcheck')}>
          <SpellcheckSettings />
        </div>
      )}
    </div>
  )
}
