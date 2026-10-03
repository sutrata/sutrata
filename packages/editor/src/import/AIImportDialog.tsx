import React, { useMemo, useRef, useState } from 'react'
import { useDocument } from '../context/DocumentContext'
import { useTranslation } from '../i18n/useTranslation'
import { useAI } from '../extensions/ai-provider'
import { readImportFile, IMPORT_ACCEPT } from './extract'
import { runAiImport, splitBlocks, blockKind, retypeBlock } from './ai-import'
import type { ChunkResult, BlockKind } from './ai-import'
import { applyImport } from './apply-import'
import { SceneIcon, ActionIcon, CharacterIcon, TransitionIcon, CenteredIcon, LyricsIcon, NoteIcon, SectionIcon } from '../shell/icons'

const KIND_LABEL_KEYS: Record<BlockKind, string> = {
  scene_heading: 'toolbar.scene',
  action: 'toolbar.action',
  character: 'aiimport.kind.character',
  transition: 'toolbar.transition',
  centered: 'toolbar.centered',
  lyrics: 'toolbar.lyrics',
  note: 'toolbar.note',
  section: 'toolbar.section',
  other: 'aiimport.kind.other',
}
const KIND_ICONS: Record<BlockKind, React.ComponentType<{ size?: number }>> = {
  scene_heading: SceneIcon,
  action: ActionIcon,
  character: CharacterIcon,
  transition: TransitionIcon,
  centered: CenteredIcon,
  lyrics: LyricsIcon,
  note: NoteIcon,
  section: SectionIcon,
  other: ActionIcon,
}
const KIND_OPTIONS = (Object.keys(KIND_LABEL_KEYS) as BlockKind[]).filter(k => k !== 'other')

type Step =
  | { name: 'source' }
  | { name: 'confirm'; fileName: string; text: string }
  | { name: 'running'; done: number; total: number }
  | { name: 'review'; fileName: string; source: string; blocks: string[]; chunks: ChunkResult[]; warnings: string[] }

/**
 * AI-assisted import (OSS spec §5.5): pick a Word/text/Markdown file (or paste
 * text), confirm the provider's data policy, let the AI format it as Sutra in
 * checked chunks, review side by side with per-block type correction, then
 * replace or append as one undoable edit. Sutrata's own DOCX skips the AI.
 * Rendered only when useAI() is non-null (a provider, and an edit session).
 */
export function AIImportDialog({ onClose }: { onClose: () => void }) {
  const ai = useAI()
  const { t } = useTranslation()
  const { text, setText, showToast } = useDocument()
  const [step, setStep] = useState<Step>({ name: 'source' })
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState('')
  const [agreed, setAgreed] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const formatted = useMemo(() => (step.name === 'review' ? step.blocks.join('\n\n') : ''), [step])

  if (!ai) return null

  const close = () => {
    abortRef.current?.abort()
    onClose()
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      const source = await readImportFile(file)
      if (source.kind === 'sutra') {
        setStep({ name: 'review', fileName: source.name, source: source.sutra, blocks: splitBlocks(source.sutra), chunks: [], warnings: source.warnings })
      } else if (!source.text.trim()) {
        setError(`${source.name} has no text to import.`)
      } else {
        setStep({ name: 'confirm', fileName: source.name, text: source.text })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const start = async (fileName: string, source: string) => {
    if (!(await ai.isConfigured())) {
      if (ai.openSetup) { close(); ai.openSetup() } else setError(`${ai.displayName} is not available right now.`)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setStep({ name: 'running', done: 0, total: 1 })
    try {
      const result = await runAiImport(ai, source, {
        signal: controller.signal,
        onProgress: (done, total) => setStep({ name: 'running', done, total }),
      })
      const warnings = result.chunks.flatMap(c => c.problems.map(p => t('aiimport.part').replace('{n}', String(c.index + 1)).replace('{problem}', p)))
      setStep({ name: 'review', fileName, source, blocks: splitBlocks(result.sutra), chunks: result.chunks, warnings })
    } catch (e) {
      if (controller.signal.aborted) { setStep({ name: 'source' }); return }
      setError(e instanceof Error ? e.message : String(e))
      setStep({ name: 'confirm', fileName, text: source })
    } finally {
      abortRef.current = null
    }
  }

  const finish = (how: 'replace' | 'append') => {
    if (step.name !== 'review') return
    applyImport(formatted, how, text, setText)
    showToast(t('aiimport.imported').replace('{file}', step.fileName).replace('{n}', String(step.blocks.length)), 'success')
    onClose()
  }

  return (
    <div className="cs-dialog-overlay" onClick={close}>
      <div
        className="cs-dialog cs-ai-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('appbar.importAI')}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') close() }}
        style={{ maxWidth: step.name === 'review' ? '1100px' : '560px', width: '94%' }}
      >
        <div className="cs-dialog-header">
          <span className="cs-dialog-title">{t('appbar.importAI')}</span>
          <button className="cs-fr-close" aria-label={t('common.close')} onClick={close}>×</button>
        </div>

        <div className={step.name === 'review' ? 'cs-ai-import-body cs-ai-import-body-review' : 'cs-ai-import-body'}>
          {error && <div className="cs-ai-import-error" role="alert">{error}</div>}

          {step.name === 'source' && (
            <>
              <p className="cs-ai-import-hint">
                {t('aiimport.hint')}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept={IMPORT_ACCEPT}
                aria-label={t('aiimport.choose')}
                onChange={e => void pickFile(e.target.files?.[0])}
              />
              <label className="cs-settings-label" htmlFor="cs-ai-import-paste" style={{ display: 'block', marginTop: 12 }}>
                {t('aiimport.paste')}
              </label>
              <textarea
                id="cs-ai-import-paste"
                className="cs-ai-import-paste"
                rows={8}
                value={pasted}
                onChange={e => setPasted(e.target.value)}
              />
              <div className="cs-ai-import-actions">
                <button
                  type="button"
                  className="cs-confirm-btn-primary"
                  disabled={!pasted.trim()}
                  onClick={() => setStep({ name: 'confirm', fileName: t('aiimport.pastedText'), text: pasted.trim() })}
                >
                  {t('aiimport.continue')}
                </button>
              </div>
            </>
          )}

          {step.name === 'confirm' && (
            <>
              <p className="cs-ai-import-hint">
                {t('aiimport.summary').replace('{file}', step.fileName).replace('{chars}', step.text.length.toLocaleString()).replace('{name}', ai.displayName)}
              </p>
              <div className="cs-ai-import-policy" aria-label={t('aiimport.policy')}>{ai.dataPolicyText}</div>
              <label className="cs-ai-import-agree">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                {t('aiimport.agree').replace('{name}', ai.displayName)}
              </label>
              <div className="cs-ai-import-actions">
                <button type="button" className="cs-confirm-btn-cancel" onClick={() => setStep({ name: 'source' })}>{t('aiimport.back')}</button>
                <button
                  type="button"
                  className="cs-confirm-btn-primary"
                  disabled={!agreed}
                  onClick={() => void start(step.fileName, step.text)}
                >
                  {t('aiimport.format')}
                </button>
              </div>
            </>
          )}

          {step.name === 'running' && (
            <>
              <p className="cs-ai-import-hint" role="status">
                <span className="cs-spinner" style={{ width: 10, height: 10, borderWidth: 1.5, marginRight: 8 }} />
                {t('aiimport.progress').replace('{done}', String(Math.min(step.done + 1, step.total))).replace('{total}', String(step.total))}
              </p>
              <div className="cs-ai-import-actions">
                <button type="button" className="cs-confirm-btn-cancel" onClick={() => abortRef.current?.abort()}>{t('common.cancel')}</button>
              </div>
            </>
          )}

          {step.name === 'review' && (
            <>
              {step.warnings.length > 0 && (
                <div className="cs-export-warnings cs-ai-import-warnings" role="alert">
                  <div className="cs-export-warn-title">{t('aiimport.check')}</div>
                  {step.warnings.map((w, i) => <div key={i} className="cs-export-warn-item">• {w}</div>)}
                </div>
              )}
              <div className="cs-ai-import-review">
                <section aria-label={t('aiimport.source')}>
                  <div className="cs-ai-import-col-title">{t('aiimport.source')}</div>
                  <pre className="cs-ai-import-source">{step.source}</pre>
                </section>
                <section aria-label={t('aiimport.formatted').replace('{n}', String(step.blocks.length))}>
                  <div className="cs-ai-import-col-title">{t('aiimport.formatted').replace('{n}', String(step.blocks.length))}</div>
                  <ol className="cs-ai-import-blocks">
                    {step.blocks.map((block, i) => {
                      const kind = blockKind(block)
                      return (
                        <li key={i} className="cs-ai-import-block">
                          <label className="cs-ai-import-kind">
                            {React.createElement(KIND_ICONS[kind], { size: 14 })}
                            <span>{t(KIND_LABEL_KEYS[kind])}</span>
                            <svg className="cs-ai-import-kind-chevron" width="8" height="5" viewBox="0 0 8 5" aria-hidden="true"><path d="M1 1l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <select
                              aria-label={t('aiimport.blockType').replace('{n}', String(i + 1))}
                              value={kind}
                              onChange={e => {
                                const blocks = [...step.blocks]
                                blocks[i] = retypeBlock(block, e.target.value as BlockKind)
                                setStep({ ...step, blocks })
                              }}
                            >
                              {kind === 'other' && <option value="other">{t(KIND_LABEL_KEYS.other)}</option>}
                              {KIND_OPTIONS.map(k => <option key={k} value={k}>{t(KIND_LABEL_KEYS[k])}</option>)}
                            </select>
                          </label>
                          <pre>{block}</pre>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              </div>
              <div className="cs-ai-import-actions">
                <button type="button" className="cs-confirm-btn-cancel" onClick={close}>{t('common.cancel')}</button>
                <button type="button" className="cs-confirm-btn-cancel" onClick={() => finish('append')} disabled={!step.blocks.length}>
                  {t('aiimport.append')}
                </button>
                <button
                  type="button"
                  className="cs-confirm-btn-primary"
                  title={t('aiimport.replaceTitle')}
                  onClick={() => finish('replace')}
                  disabled={!step.blocks.length}
                >
                  {t('aiimport.replace')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
