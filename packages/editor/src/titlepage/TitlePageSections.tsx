import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useDocument } from '../context/DocumentContext'
import { useTranslation } from '../i18n/useTranslation'
import { getEditorView } from '../editor/editor-bus'
import { applyTitlePageText } from '../editor/frontmatter-field'
import { readTitlePage, writeTitlePage } from './frontmatter-form'
import type { TitlePageForm } from './frontmatter-form'
import { TitlePageFields } from './TitlePageDialog'
import type { TitlePageGroup } from './TitlePageDialog'

/** How long after the last keystroke an edit is written to the document. */
const SAVE_DELAY_MS = 800

function Group({ id, children }: { id: TitlePageGroup; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <details className="cs-tp-group" open={id === 'story'}>
      <summary className="cs-tp-group-title">{t(`titlePage.section.${id}`)}</summary>
      <div className="cs-tp-group-body">{children}</div>
    </details>
  )
}

/**
 * The title page form for a side panel: the same fields as the dialog, in
 * collapsible groups, written to the document as you type (or leave the
 * panel) instead of on a Save button.
 */
export function TitlePageSections() {
  const { ast, text, setText, mode } = useDocument()
  const data = ast.frontmatter?.data as Record<string, unknown> | undefined
  const dataKey = JSON.stringify(data ?? null)
  const [{ form, initial }, setState] = useState(() => { const f = readTitlePage(data); return { form: f, initial: f } })
  const root = useRef<HTMLDivElement>(null)
  const dirty = useRef(false)

  // Take in changes made elsewhere (the source editor, another device), but
  // never while the writer is typing here.
  useEffect(() => {
    if (root.current?.contains(document.activeElement)) return
    const f = readTitlePage(data)
    setState({ form: f, initial: f })
    dirty.current = false
  }, [dataKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(<K extends keyof TitlePageForm>(key: K, value: TitlePageForm[K]) => {
    dirty.current = true
    setState(s => ({ ...s, form: { ...s.form, [key]: value } }))
  }, [])

  const commit = useCallback(() => {
    if (!dirty.current) return
    dirty.current = false
    const current = readTitlePage(ast.frontmatter?.data as Record<string, unknown> | undefined)
    const next = writeTitlePage(text, current, form)
    if (next !== text) applyTitlePageText(mode === 'formatted' ? getEditorView() : null, next, setText)
  }, [ast, text, form, mode, setText])

  useEffect(() => {
    if (!dirty.current) return
    const timer = setTimeout(commit, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [form, commit])

  return (
    <div ref={root} className="cs-tp-sections"
      onBlur={e => { if (!root.current?.contains(e.relatedTarget as Node | null)) commit() }}>
      <TitlePageFields form={form} set={set} initial={initial} data={data} Group={Group} />
    </div>
  )
}
