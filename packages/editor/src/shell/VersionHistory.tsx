import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { diffWordsWithSpace, type Change } from 'diff'
import type { VersionEntry } from '../types'

interface VersionHistoryProps {
  versions: VersionEntry[]
  filePath: string | null
  onRestore: (entry: VersionEntry) => void
  onClearAll: () => Promise<void>
  visible: boolean
  onClose: () => void
}

interface DiffMarker {
  type: 'added' | 'removed'
  position: number // 0..1, fraction of the diff pane's scrollHeight
}

// Word-level diff over the full text (not line-bucketed): if only one word in
// a sentence changed, only that word is marked added/removed — the rest of
// the sentence comes back as an unchanged, unstyled Change chunk. Whitespace
// (including newlines) is treated as part of the diff so line breaks survive.
function computeDiff(oldText: string, newText: string): Change[] {
  return diffWordsWithSpace(oldText, newText)
}

// Two markers within this many pixels of each other collapse into one, so a
// tight run of word edits doesn't paint a solid wall of ticks.
const CLUSTER_PX = 10

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function VersionHistory({ versions, filePath, onRestore, onClearAll, visible, onClose }: VersionHistoryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const diffScrollRef = useRef<HTMLDivElement>(null)
  // Maps a diff-part index (only added/removed parts) to its rendered <span>,
  // so marker positions come from real layout instead of a text-based estimate —
  // screenplay format has wildly uneven character density per line (short
  // character cues and blank lines vs. long action paragraphs), which threw
  // off an earlier character-offset heuristic by a page or more.
  const spanRefMap = useRef(new Map<number, HTMLSpanElement>())
  const [markers, setMarkers] = useState<DiffMarker[]>([])

  const currentVersion = versions[0] ?? null
  const selectedVersion = useMemo(
    () => versions.find(v => v.id === selectedId) ?? null,
    [versions, selectedId],
  )

  const diff = useMemo(() => {
    if (!selectedVersion || !currentVersion || selectedVersion.id === currentVersion.id) return null
    return computeDiff(selectedVersion.content, currentVersion.content)
  }, [selectedVersion, currentVersion])

  useLayoutEffect(() => {
    const container = diffScrollRef.current
    if (!container || !diff) { setMarkers([]); return }

    const raw: { type: 'added' | 'removed'; top: number }[] = []
    diff.forEach((part, i) => {
      if (!part.added && !part.removed) return
      const span = spanRefMap.current.get(i)
      if (!span) return
      raw.push({ type: part.added ? 'added' : 'removed', top: span.offsetTop })
    })
    raw.sort((a, b) => a.top - b.top)

    const scrollHeight = container.scrollHeight || 1
    const clustered: DiffMarker[] = []
    let lastTop = -Infinity
    let lastType: 'added' | 'removed' | null = null
    for (const m of raw) {
      if (lastType === m.type && m.top - lastTop < CLUSTER_PX) continue
      clustered.push({ type: m.type, position: m.top / scrollHeight })
      lastTop = m.top
      lastType = m.type
    }
    setMarkers(clustered)
  }, [diff])

  const scrollToMarker = (position: number) => {
    const el = diffScrollRef.current
    if (!el) return
    const target = Math.max(0, position * el.scrollHeight - el.clientHeight / 2)
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: target, behavior: 'smooth' })
    else el.scrollTop = target
  }

  if (!visible || !filePath) return null

  return (
    <div
      className="cs-dialog-overlay"
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="cs-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cs-version-dialog-title"
        style={{ maxWidth: '620px', width: '92%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="cs-panel-header">
          <span id="cs-version-dialog-title" className="cs-panel-title">Version History</span>
          <button className="cs-panel-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="cs-version-body">
          <div className="cs-version-list">
            {versions.length === 0 ? (
              <div className="cs-version-empty">No versions saved yet</div>
            ) : (
              versions.map((v, idx) => (
                <button
                  key={v.id}
                  type="button"
                  className={`cs-version-list-item${selectedId === v.id ? ' cs-version-list-item-active' : ''}`}
                  onClick={() => setSelectedId(v.id)}
                >
                  <div className="cs-version-list-item-label">{idx === 0 ? 'Current' : formatTimestamp(v.timestamp)}</div>
                  {idx !== 0 && <div className="cs-version-list-item-date">{formatTimestamp(v.timestamp)}</div>}
                </button>
              ))
            )}
          </div>

          <div className="cs-version-diff-wrap">
            <div className="cs-version-diff" ref={diffScrollRef}>
              {!selectedVersion ? (
                <div className="cs-version-empty">Select a version to compare against the current document</div>
              ) : selectedVersion.id === currentVersion?.id ? (
                <div className="cs-version-empty">This is the current version</div>
              ) : diff ? (
                diff.every(part => !part.added && !part.removed) ? (
                  <div className="cs-version-empty">No differences from the current version</div>
                ) : (
                  <div className="cs-version-diff-content">
                    {diff.map((part, i) => {
                      const isChange = part.added || part.removed
                      return (
                        <span
                          key={i}
                          ref={isChange ? (el) => {
                            if (el) spanRefMap.current.set(i, el)
                            else spanRefMap.current.delete(i)
                          } : undefined}
                          className={
                            part.added ? 'cs-version-diff-added'
                            : part.removed ? 'cs-version-diff-removed'
                            : undefined
                          }
                        >
                          {part.value}
                        </span>
                      )
                    })}
                  </div>
                )
              ) : null}
            </div>

            {/* Rendered unconditionally (even with zero markers) so its width is
                reserved from the diff pane's very first layout pass — otherwise
                measuring offsetTop before this strip exists, then having it pop
                in afterward and narrow the text column, would make every
                position stale by however much the text rewrapped. */}
            <div className="cs-version-diff-minimap" aria-hidden="true">
              {markers.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  className={`cs-version-diff-marker cs-version-diff-marker-${m.type}`}
                  style={{ top: `${m.position * 100}%` }}
                  title={m.type === 'added' ? 'Jump to added text' : 'Jump to removed text'}
                  onClick={() => scrollToMarker(m.position)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="cs-version-footer">
          <button
            type="button"
            className="cs-confirm-btn-cancel cs-version-clear-btn"
            onClick={() => void onClearAll()}
            disabled={versions.length === 0}
          >
            Delete Version History
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="cs-confirm-btn-cancel" onClick={onClose}>Close</button>
            {selectedVersion && selectedVersion.id !== currentVersion?.id && (
              <button
                type="button"
                className="cs-confirm-btn-primary"
                onClick={() => onRestore(selectedVersion)}
              >
                Restore This Version
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
