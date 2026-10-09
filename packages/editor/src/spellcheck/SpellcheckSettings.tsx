import React from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { REGIONAL_LANGUAGES } from './languages'
import { unignoreWord, updateSpellcheck, useSpellcheck } from './settings'

/** The Settings dialog's spell check section: on or off, and the language checked alongside English. */
export function SpellcheckSettings() {
  const { t } = useTranslation()
  const { enabled, regional, dictionaries, ignored } = useSpellcheck()
  const broken = (enabled && dictionaries['en'] === 'unavailable') || (enabled && regional && dictionaries[regional] === 'unavailable')
  return (
    <>
      <div className="cs-settings-row">
        <label className="cs-settings-label" htmlFor="cs-spellcheck-on">{t('settings.spellcheck')}</label>
        <input id="cs-spellcheck-on" type="checkbox" checked={enabled}
          onChange={e => updateSpellcheck({ enabled: e.target.checked })} />
      </div>
      <div className="cs-settings-row">
        <label className="cs-settings-label" htmlFor="cs-spellcheck-lang">{t('settings.spellcheckLanguage')}</label>
        <select id="cs-spellcheck-lang" className="cs-settings-select" value={regional} disabled={!enabled}
          onChange={e => updateSpellcheck({ regional: e.target.value })}>
          <option value="">{t('settings.spellcheckEnglishOnly')}</option>
          {REGIONAL_LANGUAGES.map(l => <option key={l.code} value={l.code}>English + {l.label}</option>)}
        </select>
      </div>
      {ignored.length > 0 && (
        <div className="cs-settings-row cs-spell-ignored">
          <span className="cs-settings-label">{t('settings.spellcheckIgnored')}</span>
          <ul className="cs-spell-ignored-list">
            {ignored.map(w => (
              <li key={w}>
                <span>{w}</span>
                <button type="button" className="cs-spell-ignored-remove" aria-label={t('settings.spellcheckStopIgnoring').replace('{word}', w)}
                  onClick={() => unignoreWord(w)}>×</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {broken && <p className="cs-settings-note" role="alert">{t('settings.spellcheckUnavailable')}</p>}
    </>
  )
}
