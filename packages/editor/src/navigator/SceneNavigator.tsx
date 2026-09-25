import React, { useEffect, useState, useCallback } from 'react'
import { TextSelection } from 'prosemirror-state'
import { useDocument } from '../context/DocumentContext'
import { useTranslation } from '../i18n/useTranslation'
import { buildSceneList, SceneEntry } from './scene-list'
import { getEditorView, getSourceView } from '../editor/editor-bus'
import { schema } from '../editor/schema'
import { EditorView as CmView } from '@codemirror/view'
import { StatisticsDialog } from './StatisticsDialog'
import { EyeIcon, EyeOffIcon, RenumberIcon, OmitIcon, RestoreIcon, StatsIcon, SparklesIcon, CloseIcon } from '../shell/icons'
import { sceneNumberIssues, renumberScenes } from './scene-numbering'
import type { SceneNumberIssue } from './scene-numbering'
import { setSceneNumbersInText, omitSceneInText, restoreSceneInText, applyTextEdit } from './scene-edits'
import { SCENE_METADATA_PROMPT, SCENE_METADATA_SCHEMA } from '../ai/prompts'
import { useAI } from '../extensions/ai-provider'
import type { AIProvider } from '../extensions/ai-provider'
import { useCanEdit } from '../extensions/session'
import { prosemirrorToSutra } from '../editor/prosemirror-to-sutra'

/** Update the scene synopsis in the raw Sutra text. */
function updateSynopsisInText(text: string, sceneOffset: number, newSynopsis: string): string {
  const lines = text.split('\n')
  let currentOffset = 0
  let targetLineIdx = -1

  for (let i = 0; i < lines.length; i++) {
    if (currentOffset === sceneOffset) {
      targetLineIdx = i
      break
    }
    currentOffset += (lines[i]?.length ?? 0) + 1
  }

  if (targetLineIdx === -1) return text

  let synopsisLineIdx = -1
  let insertIdx = targetLineIdx + 1

  for (let j = targetLineIdx + 1; j < lines.length; j++) {
    const line = (lines[j] ?? '').trim()
    if (line.startsWith('##') || line.startsWith('#')) break
    if (line.startsWith('& synopsis:')) {
      synopsisLineIdx = j
      break
    }
    if (line.startsWith('&')) {
      insertIdx = j + 1
    } else if (line !== '') {
      break
    }
  }

  const newLines = [...lines]
  if (synopsisLineIdx !== -1) {
    if (newSynopsis.trim() === '') {
      newLines.splice(synopsisLineIdx, 1)
    } else {
      newLines[synopsisLineIdx] = `& synopsis: ${newSynopsis}`
    }
  } else if (newSynopsis.trim() !== '') {
    newLines.splice(insertIdx, 0, `& synopsis: ${newSynopsis}`)
  }

  return newLines.join('\n')
}

/** Update a scene metadata key/value in the raw Sutra text. */
function updateSceneMetadataInText(text: string, sceneOffset: number, key: string, val: string): string {
  const lines = text.split('\n')
  let currentOffset = 0
  let targetLineIdx = -1

  for (let i = 0; i < lines.length; i++) {
    if (currentOffset === sceneOffset) {
      targetLineIdx = i
      break
    }
    currentOffset += (lines[i]?.length ?? 0) + 1
  }

  if (targetLineIdx === -1) return text

  let metadataLineIdx = -1
  let insertIdx = targetLineIdx + 1

  for (let j = targetLineIdx + 1; j < lines.length; j++) {
    const line = (lines[j] ?? '').trim()
    if (line.startsWith('##') || line.startsWith('#')) break
    if (line.startsWith(`& ${key}:`)) {
      metadataLineIdx = j
      break
    }
    if (line.startsWith('&')) {
      insertIdx = j + 1
    } else if (line !== '') {
      break
    }
  }

  const newLines = [...lines]
  if (metadataLineIdx !== -1) {
    if (val.trim() === '') {
      newLines.splice(metadataLineIdx, 1)
    } else {
      newLines[metadataLineIdx] = `& ${key}: ${val}`
    }
  } else if (val.trim() !== '') {
    newLines.splice(insertIdx, 0, `& ${key}: ${val}`)
  }

  return newLines.join('\n')
}

/** Update a scene metadata key/value in the ProseMirror editor document. */
function updateSceneMetadataInProseMirror(sceneIndex: number, key: string, val: string) {
  const view = getEditorView()
  if (!view) return

  let headingPmPos: number | null = null
  let headingCount = 0
  view.state.doc.forEach((node, offset) => {
    if (headingPmPos !== null) return
    if (node.type.name === 'scene_heading') {
      headingCount++
      if (headingCount === sceneIndex) headingPmPos = offset
    }
  })

  if (headingPmPos !== null) {
    let tr = view.state.tr
    let existingPos: number | null = null
    let index = view.state.doc.resolve(headingPmPos).index(0) + 1
    let pos = headingPmPos + view.state.doc.nodeAt(headingPmPos)!.nodeSize

    while (index < view.state.doc.childCount) {
      const sibling = view.state.doc.child(index)
      if (sibling.type.name === 'scene_metadata') {
        if (sibling.attrs['metaKey'] === key) {
          existingPos = pos
          break
        }
      } else {
        break
      }
      pos += sibling.nodeSize
      index++
    }

    if (existingPos !== null) {
      const node = view.state.doc.nodeAt(existingPos)!
      if (val === '') {
        tr = tr.delete(existingPos, existingPos + node.nodeSize)
      } else {
        tr = tr.replaceWith(
          existingPos + 1,
          existingPos + node.nodeSize - 1,
          schema.text(val)
        )
      }
    } else if (val !== '') {
      let insertPos = headingPmPos + view.state.doc.nodeAt(headingPmPos)!.nodeSize
      let siblingIdx = view.state.doc.resolve(headingPmPos).index(0) + 1
      while (siblingIdx < view.state.doc.childCount) {
        const sibling = view.state.doc.child(siblingIdx)
        if (sibling.type.name === 'scene_metadata') {
          insertPos += sibling.nodeSize
          siblingIdx++
        } else {
          break
        }
      }

      const metaNode = schema.nodes['scene_metadata']!.create(
        { metaKey: key },
        schema.text(val)
      )
      tr = tr.insert(insertPos, metaNode)
    }
    view.dispatch(tr)
  }
}

/** Ask the AI provider for a scene's synopsis + duration (one structured call). */
function generateSceneMetadata(ai: AIProvider, sceneText: string) {
  return ai.completeStructured<{ synopsis: string; duration: string }>({
    system: SCENE_METADATA_PROMPT, prompt: sceneText, schema: SCENE_METADATA_SCHEMA,
  })
}

/**
 * True when the provider can take calls; otherwise points the user at its
 * setup (if it has one) and returns false.
 */
async function ensureAIReady(ai: AIProvider, showToast: (m: string, type?: 'info' | 'warn') => void): Promise<boolean> {
  if (await ai.isConfigured()) return true
  if (ai.openSetup) {
    showToast('AI must be set up to generate synopsis & duration. Opening Setup...', 'info')
    ai.openSetup()
  } else {
    showToast(`${ai.displayName} is not available right now.`, 'warn')
  }
  return false
}

export function SceneNavigator() {
  const { text, setText, showToast, setNavVisible } = useDocument()
  const { t } = useTranslation()
  // AI actions appear only with an injected, permitted AIProvider; structural
  // actions (reorder, synopsis edits, number locking) only in edit sessions.
  const ai = useAI()
  const canEdit = useCanEdit()
  const [scenes, setScenes] = useState<SceneEntry[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  // New States
  const [showNavSynopsis, setShowNavSynopsis] = useState(true)
  const [statsOpen, setStatsOpen] = useState(false)
  const [editingSceneIdx, setEditingSceneIdx] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')

  // AI Generation States
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressText, setProgressText] = useState('')
  const textRef = React.useRef(text)
  textRef.current = text

  // Rebuild scene list whenever text changes
  useEffect(() => {
    setScenes(buildSceneList(text))
  }, [text])

  // Numbers that need renumbering (missing/duplicate/out of order; §7.4).
  // Nothing is flagged until at least one scene has a number.
  const numberIssues = React.useMemo(() => sceneNumberIssues(scenes.map(s => s.number)), [scenes])
  const issueLabel = (issue: SceneNumberIssue) => t(`navigator.number.${issue}`)

  const handleSceneMetadata = useCallback(async (scene: SceneEntry) => {
    setIsProcessing(true)
    setProgressText('Generating synopsis & estimating duration...')
    try {
      if (!ai || !(await ensureAIReady(ai, showToast))) return

      const idx = scenes.findIndex(s => s.index === scene.index)
      if (idx === -1) return
      const start = scene.textOffset
      const end = idx + 1 < scenes.length ? scenes[idx + 1]!.textOffset : text.length
      const sceneText = text.substring(start, end)

      const { synopsis, duration } = await generateSceneMetadata(ai, sceneText)

      const view = getEditorView()
      if (view) {
        updateSceneMetadataInProseMirror(scene.index, 'synopsis', synopsis.trim())
        updateSceneMetadataInProseMirror(scene.index, 'est-duration', duration.trim())
      } else {
        let nextText = updateSceneMetadataInText(text, scene.textOffset, 'synopsis', synopsis.trim())
        nextText = updateSceneMetadataInText(nextText, scene.textOffset, 'est-duration', duration.trim())
        setText(nextText)
      }
      showToast(`Generated synopsis & duration for scene ${scene.id || scene.index}.`, 'success')
    } catch (e: any) {
      showToast(`Scene metadata generation failed: ${e.message || String(e)}`, 'error')
    } finally {
      setIsProcessing(false)
      setProgressText('')
    }
  }, [ai, scenes, text, setText, showToast])

  const handleGenerateAllSceneMetadata = useCallback(async () => {
    setIsProcessing(true)
    setProgressText('Starting batch synopsis & duration generation...')
    try {
      if (!ai || !(await ensureAIReady(ai, showToast))) return

      const pmView = getEditorView()
      const cmView = getSourceView()
      let currentText = pmView ? prosemirrorToSutra(pmView.state.doc) : (cmView ? cmView.state.doc.toString() : textRef.current)

      let currentScenes = buildSceneList(currentText)
      const missing = currentScenes.filter(s => !s.synopsis || !s.estDuration)
      if (missing.length === 0) {
        showToast('All scenes already have synopsis and duration.', 'info')
        return
      }

      let current = 0
      for (const scene of missing) {
        current++
        setProgressText(`Generating synopsis & duration (${current}/${missing.length})...`)

        currentText = pmView ? prosemirrorToSutra(pmView.state.doc) : (cmView ? cmView.state.doc.toString() : textRef.current)
        currentScenes = buildSceneList(currentText)

        const latestScene = currentScenes.find(s => s.index === scene.index)
        if (!latestScene) continue

        const start = latestScene.textOffset
        const idx = currentScenes.findIndex(s => s.index === scene.index)
        const end = idx + 1 < currentScenes.length ? currentScenes[idx + 1]!.textOffset : currentText.length
        const sceneText = currentText.substring(start, end)

        try {
          const { synopsis, duration } = await generateSceneMetadata(ai, sceneText)

          if (pmView) {
            if (!latestScene.synopsis) updateSceneMetadataInProseMirror(scene.index, 'synopsis', synopsis.trim())
            if (!latestScene.estDuration) updateSceneMetadataInProseMirror(scene.index, 'est-duration', duration.trim())
          } else {
            let nextText = currentText
            if (!latestScene.synopsis) nextText = updateSceneMetadataInText(nextText, latestScene.textOffset, 'synopsis', synopsis.trim())
            if (!latestScene.estDuration) nextText = updateSceneMetadataInText(nextText, latestScene.textOffset, 'est-duration', duration.trim())
            if (cmView) {
              cmView.dispatch({
                changes: { from: 0, to: cmView.state.doc.length, insert: nextText }
              })
            } else {
              setText(nextText)
            }
          }
        } catch (err) {
          console.warn(`Failed scene metadata for scene ${scene.index}:`, err)
        }
      }

      showToast(`Generated synopsis & duration for ${missing.length} scenes.`, 'success')
    } catch (e: any) {
      showToast(`Batch generation failed: ${e.message || String(e)}`, 'error')
    } finally {
      setIsProcessing(false)
      setProgressText('')
    }
  }, [ai, setText, showToast])

  const handleFrontmatter = useCallback(() => {
    const view = getEditorView()
    if (!view) {
      const cmView = getSourceView()
      if (cmView) {
        cmView.dispatch({
          selection: { anchor: 0 },
          effects: CmView.scrollIntoView(0, { y: 'start' }),
        })
        cmView.focus()
      }
      return
    }
    let tr = view.state.tr
    const first = view.state.doc.firstChild
    if (canEdit && (!first || first.type.name !== 'title_page')) {
      const field = schema.nodes['frontmatter_field']!.create({ fmKey: 'title' })
      tr = tr.insert(0, schema.nodes['title_page']!.create({}, [field]))
    }
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(2)))
    view.dispatch(tr)
    view.focus()
    view.dom.closest('.cs-main')?.scrollTo({ top: 0, behavior: 'smooth' })
    if (typeof window !== 'undefined' && window.innerWidth <= 640) {
      setNavVisible(false)
    }
  }, [canEdit, setNavVisible])

  const handleJump = useCallback((scene: SceneEntry) => {
    const view = getEditorView()
    if (!view) {
      const cmView = getSourceView()
      if (cmView) {
        cmView.dispatch({
          selection: { anchor: scene.textOffset },
          effects: CmView.scrollIntoView(scene.textOffset, { y: 'start' }),
        })
        cmView.focus()
        if (typeof window !== 'undefined' && window.innerWidth <= 640) {
          setNavVisible(false)
        }
      }
      return
    }
    try {
      let headingPmPos: number | null = null
      let headingCount = 0
      view.state.doc.forEach((node, offset) => {
        if (headingPmPos !== null) return
        if (node.type.name === 'scene_heading') {
          headingCount++
          if (headingCount === scene.index) headingPmPos = offset
        }
      })
      if (headingPmPos === null) return

      const resolved = view.state.doc.resolve(headingPmPos + 1)
      const sel = TextSelection.near(resolved)
      view.dispatch(view.state.tr.setSelection(sel))
      view.focus()

      const domNode = view.nodeDOM(headingPmPos)
      const el = domNode instanceof Element ? domNode : (domNode as Node | null)?.parentElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (typeof window !== 'undefined' && window.innerWidth <= 640) {
        setNavVisible(false)
      }
    } catch {
      /* at doc boundary — ignore */
    }
  }, [setNavVisible])

  const handleDragStart = useCallback((idx: number) => {
    setDragIndex(idx)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDropIndex(idx)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIdx: number) => {
      e.preventDefault()
      if (!canEdit || dragIndex === null || dragIndex === targetIdx) {
        setDragIndex(null)
        setDropIndex(null)
        return
      }

      const newText = reorderScenes(text, scenes, dragIndex, targetIdx)
      setText(newText)
      setDragIndex(null)
      setDropIndex(null)
    },
    [canEdit, dragIndex, text, scenes, setText]
  )

  const commitSynopsis = useCallback((idx: number, scene: SceneEntry) => {
    setEditingSceneIdx(null)
    const newSynopsis = editVal.trim()
    if (newSynopsis === scene.synopsis) return

    const view = getEditorView()
    if (view) {
      let headingPmPos: number | null = null
      let headingCount = 0
      view.state.doc.forEach((node, offset) => {
        if (headingPmPos !== null) return
        if (node.type.name === 'scene_heading') {
          headingCount++
          if (headingCount === scene.index) headingPmPos = offset
        }
      })

      if (headingPmPos !== null) {
        let tr = view.state.tr
        let existingPos: number | null = null
        let index = view.state.doc.resolve(headingPmPos).index(0) + 1
        let pos = headingPmPos + view.state.doc.nodeAt(headingPmPos)!.nodeSize

        while (index < view.state.doc.childCount) {
          const sibling = view.state.doc.child(index)
          if (sibling.type.name === 'scene_metadata') {
            if (sibling.attrs['metaKey'] === 'synopsis') {
              existingPos = pos
              break
            }
          } else {
            break
          }
          pos += sibling.nodeSize
          index++
        }

        if (existingPos !== null) {
          const node = view.state.doc.nodeAt(existingPos)!
          if (newSynopsis === '') {
            tr = tr.delete(existingPos, existingPos + node.nodeSize)
          } else {
            tr = tr.replaceWith(
              existingPos + 1,
              existingPos + node.nodeSize - 1,
              schema.text(newSynopsis)
            )
          }
        } else if (newSynopsis !== '') {
          const insertPos = headingPmPos + view.state.doc.nodeAt(headingPmPos)!.nodeSize
          const metaNode = schema.nodes['scene_metadata']!.create(
            { metaKey: 'synopsis' },
            schema.text(newSynopsis)
          )
          tr = tr.insert(insertPos, metaNode)
        }
        view.dispatch(tr)
      }
    } else {
      const nextText = updateSynopsisInText(text, scene.textOffset, newSynopsis)
      setText(nextText)
    }
  }, [editVal, text, setText])

  /**
   * Current editor text: the navigator's `text` can lag the editor by a
   * render, and these actions rewrite whole scenes.
   */
  const liveText = useCallback(() => {
    const pmView = getEditorView()
    const cmView = getSourceView()
    return pmView ? prosemirrorToSutra(pmView.state.doc) : cmView ? cmView.state.doc.toString() : textRef.current
  }, [])

  // Renumber scenes (format spec §7.4): only when the writer asks.
  const handleRenumber = useCallback(() => {
    const current = liveText()
    const list = buildSceneList(current)
    const next = renumberScenes(list.map(s => s.number))
    const changed = next.filter((n, i) => n !== list[i]!.number).length
    if (changed === 0) {
      showToast('Scene numbers are already in order.', 'info')
      return
    }
    applyTextEdit(setSceneNumbersInText(current, next), setText)
    showToast(`Renumbered ${changed} scene${changed === 1 ? '' : 's'}.`, 'success')
  }, [liveText, setText, showToast])

  const handleOmitToggle = useCallback((scene: SceneEntry) => {
    const current = liveText()
    const idx = buildSceneList(current).findIndex(s => s.index === scene.index)
    if (idx === -1) return
    const omitted = scene.status.toLowerCase() === 'omitted'
    applyTextEdit(omitted ? restoreSceneInText(current, idx) : omitSceneInText(current, idx), setText)
  }, [liveText, setText])

  return (
    <div className="cs-navigator" role="navigation" aria-label="Scene Navigator">
      <div className="cs-nav-mobile-bar">
        <span className="cs-nav-mobile-title">{t('navigator.title')}</span>
        <button
          type="button"
          className="cs-nav-mobile-close"
          aria-label="Close navigator"
          onClick={() => setNavVisible(false)}
        >
          <CloseIcon size={18} />
        </button>
      </div>
      <div className="cs-nav-list">
        <button
          type="button"
          className="cs-nav-section-header cs-nav-frontmatter-btn"
          onClick={handleFrontmatter}
          title={t('navigator.frontmatter')}
        >
          <span className="cs-nav-title">{t('navigator.frontmatter')}</span>
        </button>

        <div className="cs-nav-section-header cs-nav-scenes-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="cs-nav-title">{t('navigator.title')}</span>
            <span className="cs-nav-count">{scenes.length}</span>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="cs-nav-action-btn"
              onClick={() => setShowNavSynopsis(!showNavSynopsis)}
              title={showNavSynopsis ? 'Hide Synopsis & Duration' : 'Show Synopsis & Duration'}
              aria-label={showNavSynopsis ? 'Hide Synopsis & Duration' : 'Show Synopsis & Duration'}
            >
              {showNavSynopsis ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
            </button>
            {ai && (
              <button
                type="button"
                className="cs-nav-action-btn"
                onClick={handleGenerateAllSceneMetadata}
                disabled={isProcessing}
                title="Generate synopsis & estimate duration (all scenes)"
                aria-label="Generate synopsis & estimate duration (all scenes)"
                style={{ opacity: isProcessing ? 0.5 : 1 }}
              >
                <SparklesIcon size={14} />
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                className="cs-nav-action-btn"
                onClick={handleRenumber}
                title={t('navigator.renumber')}
                aria-label={t('navigator.renumber')}
              >
                <RenumberIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {isProcessing && progressText && (
          <div
            className="cs-nav-progress"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              fontSize: '11px',
              color: 'var(--cs-ui-accent, #c4760a)',
              background: 'var(--cs-ui-bg-panel-subtle, #f4f2ea)',
              borderBottom: '1px solid var(--cs-ui-border-light, #e2e0d6)',
              fontWeight: 500,
            }}
          >
            <span className="cs-spinner" style={{ width: '10px', height: '10px', borderWidth: '1.5px' }} />
            <span>{progressText}</span>
          </div>
        )}

        {scenes.map((scene, idx) => {
          const issue = numberIssues[idx] ?? null
          const omitted = scene.status.toLowerCase() === 'omitted'
          const notes = [
            ...(scene.id ? [] : [t('navigator.missingId')]),
            ...(issue ? [issueLabel(issue)] : []),
          ]
          return (
          <div
            key={scene.id ?? `scene-${idx}`}
            role="button"
            tabIndex={0}
            aria-label={`Jump to ${scene.heading}${notes.length ? ` (${notes.join('; ')})` : ''}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleJump(scene)
              }
            }}
            className={[
              'cs-nav-item',
              // No {#id}: comments, scene-level diff, and page locking can't anchor to it.
              scene.id ? '' : 'cs-nav-scene-missing-id',
              issue ? 'cs-nav-scene-number-issue' : '',
              omitted ? 'cs-nav-scene-omitted' : '',
              dragIndex === idx ? 'cs-nav-dragging' : '',
              dropIndex === idx ? 'cs-nav-drop-target' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            draggable={canEdit}
            onClick={() => handleJump(scene)}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={() => {
              setDragIndex(null)
              setDropIndex(null)
            }}
          >
            <div className="cs-nav-scene-info">
              <div className="cs-nav-heading">{scene.heading}</div>

              {showNavSynopsis && (
                <div className="cs-nav-synopsis-row" style={{ marginTop: '4px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {!canEdit ? (
                      scene.synopsis ? <div className="cs-nav-scene-synopsis">{scene.synopsis}</div> : null
                    ) : editingSceneIdx === idx ? (
                      <input
                        type="text"
                        className="cs-nav-synopsis-input"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onBlur={() => commitSynopsis(idx, scene)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitSynopsis(idx, scene)
                          if (e.key === 'Escape') setEditingSceneIdx(null)
                        }}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : scene.synopsis ? (
                      <div
                        className="cs-nav-scene-synopsis"
                        onClick={e => {
                          e.stopPropagation()
                          setEditingSceneIdx(idx)
                          setEditVal(scene.synopsis)
                        }}
                        title="Click to edit synopsis"
                      >
                        {scene.synopsis}
                      </div>
                    ) : (
                      <div
                        className="cs-nav-scene-synopsis cs-nav-synopsis-placeholder"
                        onClick={e => {
                          e.stopPropagation()
                          setEditingSceneIdx(idx)
                          setEditVal('')
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label="Add synopsis"
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation()
                            e.preventDefault()
                            setEditingSceneIdx(idx)
                            setEditVal('')
                          }
                        }}
                      >
                        + Synopsis
                      </div>
                    )}
                  </div>

                  {ai && <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void handleSceneMetadata(scene) }}
                    disabled={isProcessing}
                    title="Generate synopsis & estimate duration"
                    aria-label="Generate synopsis & estimate duration"
                    className="cs-nav-action-btn cs-nav-synopsis-ai-btn"
                    style={{ color: 'var(--cs-ui-accent, #c4760a)', ...(isProcessing ? { opacity: 0.5 } : {}) }}
                  >
                    <SparklesIcon size={12} />
                  </button>}
                </div>
              )}

              {(scene.status || (showNavSynopsis && scene.estDuration)) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                  {scene.status && (
                    <span
                      className={`cs-nav-status cs-status-${scene.status
                        .toLowerCase()
                        .replace(/\s+/g, '-')}`}
                    >
                      {scene.status}
                    </span>
                  )}
                  {showNavSynopsis && scene.estDuration && (
                    <span
                      className="cs-nav-status"
                      title="Estimated Onscreen Duration"
                      style={{
                        background: 'rgba(217, 119, 6, 0.1)',
                        color: 'var(--cs-ui-accent, #c4760a)',
                        border: '1px solid rgba(217, 119, 6, 0.25)',
                        fontWeight: 600,
                      }}
                    >
                      ⏱ {scene.estDuration}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="cs-nav-scene-side">
              {/* The scene number is & number:, falling back to the {#id} (§6.1) —
                  except when numbering is in use and this scene has none yet. */}
              {issue !== 'missing' && (scene.number ?? scene.id) ? (
                <div
                  className={`cs-nav-scene-num${issue ? ' cs-nav-num-issue' : ''}`}
                  title={issue ? issueLabel(issue) : undefined}
                >
                  {scene.number ?? scene.id}
                </div>
              ) : issue ? (
                <div className="cs-nav-scene-num cs-nav-num-issue" title={issueLabel(issue)}>#?</div>
              ) : null}
              {!scene.id && (
                <div className="cs-nav-missing-id-icon" title={t('navigator.missingId')} aria-hidden="true">⚠</div>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="cs-nav-action-btn cs-nav-omit-btn"
                  title={omitted ? t('navigator.restoreScene') : t('navigator.omitScene')}
                  aria-label={`${omitted ? t('navigator.restoreScene') : t('navigator.omitScene')}: ${scene.heading}`}
                  onClick={e => { e.stopPropagation(); handleOmitToggle(scene) }}
                >
                  {omitted ? <RestoreIcon size={12} /> : <OmitIcon size={12} />}
                </button>
              )}
            </div>
          </div>
          )
        })}

        {scenes.length === 0 && (
          <div className="cs-nav-empty">
            {t('navigator.empty')}
          </div>
        )}

        <div style={{ marginTop: '20px', padding: '0 8px 10px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
          <button
            type="button"
            className="cs-nav-section-header cs-nav-frontmatter-btn"
            onClick={() => setStatsOpen(true)}
            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <StatsIcon size={14} /> <span className="cs-nav-title">Statistics</span>
          </button>
        </div>
      </div>

      {statsOpen && <StatisticsDialog onClose={() => setStatsOpen(false)} />}
    </div>
  )
}

/**
 * Reorder scene blocks in the source text.
 * Moves the entire block (heading through next heading) without mutating IDs.
 */
function reorderScenes(
  text: string,
  scenes: SceneEntry[],
  fromIdx: number,
  toIdx: number
): string {
  const lines = text.split('\n')

  const sceneLineRanges = scenes.map((scene, i) => {
    const nextScene = scenes[i + 1]
    const startLine = findLineAt(lines, scene.textOffset)
    const endLine = nextScene
      ? findLineAt(lines, nextScene.textOffset) - 1
      : lines.length - 1
    return { startLine, endLine }
  })

  // Extract prefix before first scene
  const firstSceneStart = sceneLineRanges[0]?.startLine ?? 0
  const prefixLines = lines.slice(0, firstSceneStart)

  // Extract line blocks for each scene
  const blocks = sceneLineRanges.map(r => lines.slice(r.startLine, r.endLine + 1))

  const blockToMove = blocks[fromIdx]
  if (!blockToMove) return text

  // Remove the block from the list
  const remainingBlocks = blocks.filter((_, i) => i !== fromIdx)

  // Insert the block at the target index
  remainingBlocks.splice(toIdx, 0, blockToMove)

  // Rebuild the text
  const finalLines = [...prefixLines]
  for (const b of remainingBlocks) {
    finalLines.push(...b)
  }

  return finalLines.join('\n')
}

function findLineAt(lines: string[], offset: number): number {
  let pos = 0
  for (let i = 0; i < lines.length; i++) {
    if (pos >= offset) return i
    pos += (lines[i]?.length ?? 0) + 1
  }
  return lines.length - 1
}
