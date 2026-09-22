import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useDocument } from '../context/DocumentContext'
import { useTranslation } from '../i18n/useTranslation'
import { allStyles, resolveStyle } from '../styles/registry'
import { getEditorView } from '../editor/editor-bus'
import { applyTitlePageText } from '../editor/frontmatter-field'
import { readTitlePage, writeTitlePage, MANAGED_KEYS } from './frontmatter-form'
import type { TitlePageForm, PageSize } from './frontmatter-form'
import { languageOptions } from './languages'

export { OPEN_TITLE_PAGE_EVENT, openTitlePageForm } from '../editor/editor-bus'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const TABS = ['story', 'credits', 'draft', 'contact', 'document', 'other'] as const
type Tab = typeof TABS[number]

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

interface Props {
  onClose: () => void
}

export function TitlePageDialog({ onClose }: Props) {
  const { ast, text, setText, mode, customStyles, showToast } = useDocument()
  const { t } = useTranslation()
  const data = ast.frontmatter?.data as Record<string, unknown> | undefined
  const initial = useMemo(() => readTitlePage(data), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState<TitlePageForm>(initial)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('story')
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})

  /** Arrow keys move between tabs (vertical tab list; left/right also work). */
  function onTabKey(e: React.KeyboardEvent, current: Tab) {
    const i = TABS.indexOf(current)
    let next: Tab | undefined
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length]
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = TABS[(i - 1 + TABS.length) % TABS.length]
    else if (e.key === 'Home') next = TABS[0]
    else if (e.key === 'End') next = TABS[TABS.length - 1]
    if (!next) return
    e.preventDefault()
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  const set = <K extends keyof TitlePageForm>(key: K, value: TitlePageForm[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  useEffect(() => {
    firstFieldRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const langs = languageOptions([
    form.lang, ...form.langSecondary, ...form.altTitles.map(a => a.lang),
  ])
  const langLabel = (code: string) => langs.find(l => l.code === code)?.label ?? code
  const styles = allStyles(customStyles)
  const defaultStyleName = resolveStyle(undefined, customStyles).name
  const logWords = wordCount(form.logline)

  // Frontmatter keys the form neither manages nor shows as a custom row: kept as is.
  const preservedCount = data
    ? Object.keys(data).filter(k =>
        !(MANAGED_KEYS as readonly string[]).includes(k) &&
        !initial.custom.some(c => c.key === k)).length
    : 0

  function save() {
    const current = readTitlePage(ast.frontmatter?.data as Record<string, unknown> | undefined)
    const next = writeTitlePage(text, current, form)
    if (next !== text) {
      applyTitlePageText(mode === 'formatted' ? getEditorView() : null, next, setText)
      showToast(t('titlePage.saved'), 'success')
    }
    onClose()
  }

  return (
    <div
      className="cs-export-overlay"
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="cs-export-dialog cs-tp-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-tp-title">
        <div className="cs-panel-header">
          <span id="cs-tp-title" className="cs-panel-title">{t('titlePage.title')}</span>
          <button className="cs-panel-close" onClick={onClose} aria-label={t('titlePage.cancel')}>×</button>
        </div>

        <div className="cs-tp-body">
        <div className="cs-tp-tabs" role="tablist" aria-orientation="vertical" aria-label={t('titlePage.title')}>
          {TABS.map(id => (
            <button
              key={id}
              ref={el => { tabRefs.current[id] = el }}
              type="button"
              role="tab"
              id={`cs-tp-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`cs-tp-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              className={`cs-tp-tab${tab === id ? ' cs-tp-tab-active' : ''}`}
              onClick={() => setTab(id)}
              onKeyDown={e => onTabKey(e, id)}
            >
              {t(`titlePage.section.${id}`)}
            </button>
          ))}
        </div>
        <form
          className="cs-tp-form"
          onSubmit={e => { e.preventDefault(); save() }}
        >
          <Panel id="story" active={tab}>
            <Field label={t('titlePage.field.title')} htmlFor="cs-tp-f-title">
              <input id="cs-tp-f-title" ref={firstFieldRef} className="cs-tp-input" value={form.title}
                onChange={e => set('title', e.target.value)} />
            </Field>
            {form.altTitles.map((alt, i) => (
              <div className="cs-tp-row" key={i}>
                <select aria-label={t('titlePage.field.titleLanguage')} className="cs-settings-select cs-tp-lang-select"
                  value={alt.lang}
                  onChange={e => set('altTitles', form.altTitles.map((a, j) => j === i ? { ...a, lang: e.target.value } : a))}>
                  <option value="">{t('titlePage.chooseLanguage')}</option>
                  {langs.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                <input aria-label={t('titlePage.field.titleIn')} className="cs-tp-input" value={alt.text}
                  onChange={e => set('altTitles', form.altTitles.map((a, j) => j === i ? { ...a, text: e.target.value } : a))} />
                <button type="button" className="cs-tp-remove" aria-label={t('titlePage.remove')}
                  onClick={() => set('altTitles', form.altTitles.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="cs-tp-add"
              onClick={() => set('altTitles', [...form.altTitles, { lang: '', text: '' }])}>
              + {t('titlePage.addTitle')}
            </button>
            <Field label={t('titlePage.field.logline')} htmlFor="cs-tp-f-logline"
              hint={<span className={logWords > 50 ? 'cs-tp-count-bad' : logWords > 30 ? 'cs-tp-count-warn' : 'cs-tp-count'}>
                {t('titlePage.words').replace('{n}', String(logWords))}
              </span>}>
              <textarea id="cs-tp-f-logline" className="cs-tp-input" rows={2} value={form.logline}
                onChange={e => set('logline', e.target.value)} />
            </Field>
          </Panel>

          <Panel id="credits" active={tab}>
            <TextField id="author" label={t('titlePage.field.author')} value={form.author} onChange={v => set('author', v)} />
            <TextField id="credit" label={t('titlePage.field.credit')} placeholder="Written by" value={form.credit} onChange={v => set('credit', v)} />
            <TextField id="source" label={t('titlePage.field.source')} value={form.source} onChange={v => set('source', v)} />
            <TextField id="story" label={t('titlePage.field.story')} value={form.story} onChange={v => set('story', v)} />
            <TextField id="screenplay" label={t('titlePage.field.screenplay')} value={form.screenplay} onChange={v => set('screenplay', v)} />
            <TextField id="dialogue" label={t('titlePage.field.dialogue')} value={form.dialogue} onChange={v => set('dialogue', v)} />
          </Panel>

          <Panel id="draft" active={tab}>
            <TextField id="draft" label={t('titlePage.field.draft')} placeholder="First Draft" value={form.draft} onChange={v => set('draft', v)} />
            <TextField id="revision" label={t('titlePage.field.revision')} value={form.revision} onChange={v => set('revision', v)} />
            <Field label={t('titlePage.field.date')} htmlFor="cs-tp-f-date">
              <DateInput id="cs-tp-f-date" value={form.date} onChange={v => set('date', v)}
                usePickerLabel={t('titlePage.usePicker')} useTextLabel={t('titlePage.useText')} />
            </Field>
          </Panel>

          <Panel id="contact" active={tab}>
            <Field label={t('titlePage.field.contact')} htmlFor="cs-tp-f-contact">
              <textarea id="cs-tp-f-contact" className="cs-tp-input" rows={3} value={form.contact}
                onChange={e => set('contact', e.target.value)} />
            </Field>
            <TextField id="copyright" label={t('titlePage.field.copyright')} placeholder="© 2026 …" value={form.copyright} onChange={v => set('copyright', v)} />
          </Panel>

          <Panel id="document" active={tab}>
            <Field label={t('titlePage.field.lang')} htmlFor="cs-tp-f-lang">
              <select id="cs-tp-f-lang" className="cs-settings-select" value={form.lang}
                onChange={e => set('lang', e.target.value)}>
                <option value="">{t('titlePage.notSet')}</option>
                {langs.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </Field>
            <Field label={t('titlePage.field.langSecondary')} htmlFor="cs-tp-f-lang2">
              <div className="cs-tp-chips">
                {form.langSecondary.map(code => (
                  <span className="cs-tp-chip" key={code}>
                    {langLabel(code)}
                    <button type="button" aria-label={`${t('titlePage.remove')} ${langLabel(code)}`}
                      onClick={() => set('langSecondary', form.langSecondary.filter(c => c !== code))}>×</button>
                  </span>
                ))}
                <select id="cs-tp-f-lang2" className="cs-settings-select" value=""
                  onChange={e => {
                    const code = e.target.value
                    if (code && !form.langSecondary.includes(code)) set('langSecondary', [...form.langSecondary, code])
                  }}>
                  <option value="">{t('titlePage.addLanguage')}</option>
                  {langs.filter(l => l.code !== form.lang && !form.langSecondary.includes(l.code))
                    .map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
            </Field>
            <Field label={t('titlePage.field.page')} htmlFor="cs-tp-f-page">
              <select id="cs-tp-f-page" className="cs-settings-select" value={form.page}
                onChange={e => set('page', e.target.value as PageSize)}>
                <option value="">{t('titlePage.pageDefault')}</option>
                <option value="A4">A4</option>
                <option value="Letter">US Letter</option>
              </select>
            </Field>
            <Field label={t('titlePage.field.style')} htmlFor="cs-tp-f-style">
              <select id="cs-tp-f-style" className="cs-settings-select" value={form.style}
                onChange={e => set('style', e.target.value)}>
                <option value="">{t('titlePage.styleDefault').replace('{name}', defaultStyleName)}</option>
                {styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                {form.style && !styles.some(s => s.id === form.style) && (
                  <option value={form.style}>{form.style}</option>
                )}
              </select>
            </Field>
            <TextField id="watermark" label={t('titlePage.field.watermark')} placeholder="CONFIDENTIAL" value={form.watermark} onChange={v => set('watermark', v)} />
          </Panel>

          <Panel id="other" active={tab}>
            {form.custom.map((c, i) => (
              <div className="cs-tp-row" key={i}>
                <input aria-label={t('titlePage.field.key')} className="cs-tp-input cs-tp-key" value={c.key}
                  placeholder="key"
                  onChange={e => set('custom', form.custom.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} />
                <input aria-label={t('titlePage.field.value')} className="cs-tp-input" value={c.value}
                  onChange={e => set('custom', form.custom.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                <button type="button" className="cs-tp-remove" aria-label={t('titlePage.remove')}
                  onClick={() => set('custom', form.custom.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="cs-tp-add"
              onClick={() => set('custom', [...form.custom, { key: '', value: '' }])}>
              + {t('titlePage.addField')}
            </button>
            {preservedCount > 0 && (
              <p className="cs-tp-note">{t('titlePage.preserved').replace('{n}', String(preservedCount))}</p>
            )}
          </Panel>
        </form>
        </div>

        <div className="cs-export-actions cs-tp-actions">
          <button type="button" className="cs-confirm-btn-cancel" onClick={onClose}>{t('titlePage.cancel')}</button>
          <button type="button" className="cs-confirm-btn-primary" onClick={save}>{t('titlePage.save')}</button>
        </div>
      </div>
    </div>
  )
}

function Panel({ id, active, children }: { id: Tab; active: Tab; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`cs-tp-panel-${id}`}
      aria-labelledby={`cs-tp-tab-${id}`}
      className="cs-tp-panel"
      hidden={active !== id}
    >
      {children}
    </div>
  )
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="cs-tp-field">
      <label className="cs-tp-label" htmlFor={htmlFor}>{label}{hint ? <> {hint}</> : null}</label>
      {children}
    </div>
  )
}

function TextField({ id, label, value, placeholder, onChange }: {
  id: string; label: string; value: string; placeholder?: string; onChange: (v: string) => void
}) {
  return (
    <Field label={label} htmlFor={`cs-tp-f-${id}`}>
      <input id={`cs-tp-f-${id}`} className="cs-tp-input" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
    </Field>
  )
}

/** Date picker for ISO dates (YYYY-MM-DD). A date already written as free text (e.g.
 *  "June 2026") stays editable as text, with a switch to the picker. */
function DateInput({ id, value, onChange, usePickerLabel, useTextLabel }: {
  id: string; value: string; onChange: (v: string) => void; usePickerLabel: string; useTextLabel: string
}) {
  const [asText, setAsText] = useState(value !== '' && !ISO_DATE.test(value))
  return (
    <div className="cs-tp-date">
      {asText
        ? <input id={id} className="cs-tp-input" value={value} onChange={e => onChange(e.target.value)} />
        : <input id={id} type="date" className="cs-tp-input" value={ISO_DATE.test(value) ? value : ''}
            onChange={e => onChange(e.target.value)} />}
      <button type="button" className="cs-tp-link" onClick={() => setAsText(!asText)}>
        {asText ? usePickerLabel : useTextLabel}
      </button>
    </div>
  )
}
