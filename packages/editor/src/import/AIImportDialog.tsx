import React, { useMemo, useRef, useState } from 'react'
import { useDocument } from '../context/DocumentContext'
import { useAI } from '../extensions/ai-provider'
import { readImportFile, IMPORT_ACCEPT } from './extract'
import { runAiImport, splitBlocks, blockKind, retypeBlock } from './ai-import'
import type { ChunkResult, BlockKind } from './ai-import'
import { applyImport } from './apply-import'

const KIND_LABELS: Record<BlockKind, string> = {
  scene_heading: 'Scene heading',
  action: 'Action',
  character: 'Character + dialogue',
  transition: 'Transition',
  centered: 'Centered',
  lyrics: 'Lyrics',
  note: 'Note',
  section: 'Section',
  other: 'Other',
}
const KIND_OPTIONS = (Object.keys(KIND_LABELS) as BlockKind[]).filter(k => k !== 'other')

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
      const warnings = result.chunks.flatMap(c => c.problems.map(p => `Part ${c.index + 1}: ${p}`))
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
    showToast(`Imported ${step.fileName} (${step.blocks.length} blocks).`, 'success')
    onClose()
  }

  return (
    <div className="cs-dialog-overlay" onClick={close}>
      <div
        className="cs-dialog cs-ai-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Import with AI"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') close() }}
        style={{ maxWidth: step.name === 'review' ? '1100px' : '560px', width: '94%' }}
      >
        <div className="cs-dialog-header">
          <span className="cs-dialog-title">Import with AI</span>
          <button className="cs-fr-close" aria-label="Close" onClick={close}>×</button>
        </div>

        <div className="cs-ai-import-body">
          {error && <div className="cs-ai-import-error" role="alert">{error}</div>}

          {step.name === 'source' && (
            <>
              <p className="cs-ai-import-hint">
                Import a screenplay written in Word, a text file or Markdown. The AI formats it as Sutra;
                you review the result before anything changes. A Word file exported from Sutrata is imported
                directly, without AI.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept={IMPORT_ACCEPT}
                aria-label="Choose a file to import"
                onChange={e => void pickFile(e.target.files?.[0])}
              />
              <label className="cs-settings-label" htmlFor="cs-ai-import-paste" style={{ display: 'block', marginTop: 12 }}>
                …or paste the text
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
                  onClick={() => setStep({ name: 'confirm', fileName: 'pasted text', text: pasted.trim() })}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step.name === 'confirm' && (
            <>
              <p className="cs-ai-import-hint">
                <strong>{step.fileName}</strong> ({step.text.length.toLocaleString()} characters) will be sent to{' '}
                <strong>{ai.displayName}</strong> to be formatted.
              </p>
              <div className="cs-ai-import-policy" aria-label="Data policy">{ai.dataPolicyText}</div>
              <label className="cs-ai-import-agree">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                I understand, send this text to {ai.displayName}
              </label>
              <div className="cs-ai-import-actions">
                <button type="button" className="cs-confirm-btn-cancel" onClick={() => setStep({ name: 'source' })}>Back</button>
                <button
                  type="button"
                  className="cs-confirm-btn-primary"
                  disabled={!agreed}
                  onClick={() => void start(step.fileName, step.text)}
                >
                  Format with AI
                </button>
              </div>
            </>
          )}

          {step.name === 'running' && (
            <>
              <p className="cs-ai-import-hint" role="status">
                <span className="cs-spinner" style={{ width: 10, height: 10, borderWidth: 1.5, marginRight: 8 }} />
                Formatting part {Math.min(step.done + 1, step.total)} of {step.total}…
              </p>
              <div className="cs-ai-import-actions">
                <button type="button" className="cs-confirm-btn-cancel" onClick={() => abortRef.current?.abort()}>Cancel</button>
              </div>
            </>
          )}

          {step.name === 'review' && (
            <>
              {step.warnings.length > 0 && (
                <div className="cs-export-warnings cs-ai-import-warnings" role="alert">
                  <div className="cs-export-warn-title">Check these parts before importing</div>
                  {step.warnings.map((w, i) => <div key={i} className="cs-export-warn-item">• {w}</div>)}
                </div>
              )}
              <div className="cs-ai-import-review">
                <section aria-label="Source">
                  <div className="cs-ai-import-col-title">Source</div>
                  <pre className="cs-ai-import-source">{step.source}</pre>
                </section>
                <section aria-label="Formatted">
                  <div className="cs-ai-import-col-title">Formatted ({step.blocks.length} blocks)</div>
                  <ol className="cs-ai-import-blocks">
                    {step.blocks.map((block, i) => {
                      const kind = blockKind(block)
                      return (
                        <li key={i} className="cs-ai-import-block">
                          <select
                            aria-label={`Block ${i + 1} type`}
                            className="cs-settings-select"
                            value={kind}
                            onChange={e => {
                              const blocks = [...step.blocks]
                              blocks[i] = retypeBlock(block, e.target.value as BlockKind)
                              setStep({ ...step, blocks })
                            }}
                          >
                            {kind === 'other' && <option value="other">{KIND_LABELS.other}</option>}
                            {KIND_OPTIONS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                          </select>
                          <pre>{block}</pre>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              </div>
              <div className="cs-ai-import-actions">
                <button type="button" className="cs-confirm-btn-cancel" onClick={close}>Cancel</button>
                <button type="button" className="cs-confirm-btn-cancel" onClick={() => finish('append')} disabled={!step.blocks.length}>
                  Append to document
                </button>
                <button
                  type="button"
                  className="cs-confirm-btn-primary"
                  title="Replaces the script; the title page is kept"
                  onClick={() => finish('replace')}
                  disabled={!step.blocks.length}
                >
                  Replace script
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
