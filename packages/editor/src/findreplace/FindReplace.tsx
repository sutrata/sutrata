import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useCanEdit } from '../extensions/session'
import { useDocument } from '../context/DocumentContext'
import { useTranslation } from '../i18n/useTranslation'
import { findAll, replaceAll } from './find-engine'
import { findInPmDoc, scrollToPmMatch } from './scroll-to-match'
import type { PmMatch } from './scroll-to-match'
import { getEditorView } from '../editor/editor-bus'
import { setFindHighlights, clearFindHighlights } from '../editor/find-highlight-plugin'
import { setSourceFindHighlights, clearSourceFindHighlights, scrollToSourceMatch } from '../source/find-highlight-source'

export function FindReplace() {
  const { text, setText, mode, findReplaceVisible, setFindReplaceVisible, findMode, setFindMode } = useDocument()
  const canEdit = useCanEdit()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [matches, setMatches] = useState<PmMatch[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const queryRef = useRef<HTMLInputElement>(null)
  const nextIndexAfterReplace = useRef<number | null>(null)

  // What the next highlight pass should scroll: 'none' (text edits), 'soft'
  // (query typing: only if the match is off-screen), 'center' (navigation).
  const pendingScroll = useRef<'none' | 'soft' | 'center'>('none')
  const lastSearch = useRef({ query: '', caseSensitive: false, mode: mode as string })

  // Recompute matches whenever query/text/caseSensitive/mode changes — but only
  // while the panel is open, so a leftover query never affects the editor.
  // In formatted mode we search the PM doc's display text (not raw Sutra) so
  // offsets are correct; in source mode the CodeMirror doc *is* the raw Sutra
  // text, so raw-offset matches from find-engine map directly onto it.
  useEffect(() => {
    if (!findReplaceVisible) return
    if (!query) {
      setMatches([])
      setCurrentIndex(0)
      clearFindHighlights()
      clearSourceFindHighlights()
      lastSearch.current = { query, caseSensitive, mode }
      return
    }
    let found: PmMatch[]
    if (mode === 'source') {
      found = findAll(text, query, { caseSensitive }).map(m => ({
        start: m.start, end: m.end, pmFrom: m.start, pmTo: m.end, text: m.text,
      }))
    } else {
      const view = getEditorView()
      found = view ? findInPmDoc(view.state.doc, query, { caseSensitive }) : []
    }
    const prev = lastSearch.current
    const searchChanged = prev.query !== query || prev.caseSensitive !== caseSensitive || prev.mode !== mode
    lastSearch.current = { query, caseSensitive, mode }
    setMatches(found)
    if (nextIndexAfterReplace.current !== null) {
      const idx = Math.min(nextIndexAfterReplace.current, Math.max(0, found.length - 1))
      setCurrentIndex(idx)
      nextIndexAfterReplace.current = null
      pendingScroll.current = 'center'
    } else {
      setCurrentIndex(0)
      // Plain document edits must not move the viewport.
      pendingScroll.current = searchChanged ? 'soft' : 'none'
    }
  // text in deps so we re-search after replace; view not in deps (stable ref)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, text, caseSensitive, mode, findReplaceVisible])

  // Update the active highlight (and scroll if requested) whenever matches/index change.
  useEffect(() => {
    if (!findReplaceVisible || !query) return
    const scroll = pendingScroll.current
    pendingScroll.current = 'none'
    const cur = matches[currentIndex]
    if (mode === 'source') {
      setSourceFindHighlights(matches, currentIndex)
      if (cur && scroll !== 'none') scrollToSourceMatch(cur, scroll === 'center')
    } else {
      setFindHighlights(matches, currentIndex)
      if (cur && scroll !== 'none') scrollToPmMatch(cur, scroll === 'center')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, matches, mode, findReplaceVisible])

  // Clear highlights when the panel closes.
  useEffect(() => {
    if (!findReplaceVisible) {
      clearFindHighlights()
      clearSourceFindHighlights()
    }
  }, [findReplaceVisible])

  // Focus the input when the panel opens.
  useEffect(() => {
    if (findReplaceVisible) queryRef.current?.focus()
  }, [findReplaceVisible])

  const goNext = useCallback(() => {
    if (matches.length === 0) return
    pendingScroll.current = 'center'
    setCurrentIndex(i => (i + 1) % matches.length)
  }, [matches.length])

  const goPrev = useCallback(() => {
    if (matches.length === 0) return
    pendingScroll.current = 'center'
    setCurrentIndex(i => (i - 1 + matches.length) % matches.length)
  }, [matches.length])

  const handleReplaceOne = useCallback(() => {
    if (matches.length === 0) return
    const match = matches[currentIndex]!
    let newText: string
    if (mode === 'source') {
      // In source mode the match's start/end are already raw Sutra offsets.
      newText = text.slice(0, match.start) + replacement + text.slice(match.end)
    } else {
      const needle = match.text
      // Find the Nth (currentIndex-th) occurrence of the matched display text in the
      // raw Sutra source. Display text and raw source share the same word characters;
      // sigils (##, **, blank lines) don't contain prose words, so occurrence index is stable.
      let rawIdx = -1
      let count = 0
      let searchFrom = 0
      while (searchFrom < text.length) {
        const found = text.indexOf(needle, searchFrom)
        if (found === -1) break
        if (count === currentIndex) { rawIdx = found; break }
        count++
        searchFrom = found + 1
      }
      if (rawIdx === -1) return
      newText = text.slice(0, rawIdx) + replacement + text.slice(rawIdx + needle.length)
    }
    nextIndexAfterReplace.current = Math.min(currentIndex, matches.length - 2)
    setText(newText)
  }, [matches, currentIndex, text, replacement, setText, mode])

  const handleReplaceAll = useCallback(() => {
    if (!query || matches.length === 0) return
    setText(replaceAll(text, query, replacement, { caseSensitive }))
  }, [text, query, replacement, caseSensitive, matches.length, setText])

  const handleQueryKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setFindReplaceVisible(false); return }
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); goPrev(); return }
    if (e.key === 'Enter') { e.preventDefault(); goNext(); return }
  }, [setFindReplaceVisible, goNext, goPrev])

  if (!findReplaceVisible) return null

  // Read-only sessions can search but not replace.
  const isReplace = findMode === 'replace' && canEdit
  const hasMatches = matches.length > 0

  return (
    <div className="cs-find-replace" role="dialog" aria-label={isReplace ? 'Find and Replace' : 'Find'}>
      <div className="cs-fr-header">
        <div className="cs-fr-mode-tabs">
          <button
            className={`cs-fr-tab${!isReplace ? ' cs-fr-tab-active' : ''}`}
            onClick={() => setFindMode('find')}
          >{t('findreplace.findOnly')}</button>
          {canEdit && <button
            className={`cs-fr-tab${isReplace ? ' cs-fr-tab-active' : ''}`}
            onClick={() => setFindMode('replace')}
          >{t('findreplace.title')}</button>}
        </div>
        <button
          className="cs-fr-close"
          aria-label="Close"
          onClick={() => setFindReplaceVisible(false)}
        >×</button>
      </div>

      {/* Search row: input + nav buttons inline + Aa toggle */}
      <div className="cs-fr-row">
        <input
          ref={queryRef}
          className="cs-fr-input"
          type="text"
          placeholder={t('findreplace.find')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleQueryKeyDown}
          aria-label="Find"
        />
        <button
          type="button"
          className="cs-fr-nav-btn"
          aria-label="Previous match"
          title="Previous match (Shift+Enter)"
          onClick={goPrev}
          disabled={!hasMatches}
        >▲</button>
        <button
          type="button"
          className="cs-fr-nav-btn"
          aria-label="Next match"
          title="Next match (Enter)"
          onClick={goNext}
          disabled={!hasMatches}
        >▼</button>
        <button
          type="button"
          className={`cs-fr-toggle${caseSensitive ? ' cs-fr-active' : ''}`}
          onClick={() => setCaseSensitive(v => !v)}
          title={t('findreplace.caseSensitive')}
          aria-pressed={caseSensitive}
        >Aa</button>
      </div>

      {/* Status: count or no-match, always same height to avoid layout shift */}
      <div className="cs-fr-status">
        {query && !hasMatches && (
          <span className="cs-fr-nomatch">{t('findreplace.noMatches')}</span>
        )}
        {hasMatches && (
          <span className="cs-fr-nav-count">{currentIndex + 1} of {matches.length}</span>
        )}
      </div>

      {isReplace && (
        <>
          <div className="cs-fr-row">
            <input
              className="cs-fr-input"
              type="text"
              placeholder={t('findreplace.replace')}
              value={replacement}
              onChange={e => setReplacement(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setFindReplaceVisible(false) }}
              aria-label="Replace with"
            />
          </div>
          <div className="cs-fr-actions">
            <button
              className="cs-fr-btn"
              onClick={handleReplaceOne}
              disabled={!hasMatches}
            >
              {t('findreplace.replaceOne')}
            </button>
            <button
              className="cs-fr-btn"
              onClick={handleReplaceAll}
              disabled={!query || !hasMatches}
            >
              {t('findreplace.replaceAll')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
