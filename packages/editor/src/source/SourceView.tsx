import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { sutraLanguage } from './sutra-lang'
import { useDocument } from '../context/DocumentContext'
import { setSourceView } from '../editor/editor-bus'
import { sourceFindHighlightExtension } from './find-highlight-source'

// Light theme matching the app's warm off-white palette.
// No internal scroll — the editor grows to content height and .cs-main scrolls.
const sutraTheme = EditorView.theme({
  '&': {
    width: '100%',
    maxWidth: '960px',
    fontSize: '12pt',
    fontFamily: "'Courier New', Courier, monospace",
    lineHeight: '1.5',
    backgroundColor: 'transparent',
  },
  '.cm-scroller': { overflow: 'visible', lineHeight: '1.5' },
  '.cm-content': { padding: '0', caretColor: '#1a1a18' },
  '.cm-line': { padding: '0' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: '#1a1a18' },
  '.cm-selectionBackground, ::selection': { backgroundColor: '#b8d3f0' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#b8d3f0' },
})

const sutraHighlight = HighlightStyle.define([
  // ## Scene heading — dark teal, bold
  { tag: tags.keyword, color: '#0a5c6a', fontWeight: 'bold' },
  // # Section heading — medium slate
  { tag: tags.heading, color: '#4a5568', fontWeight: 'bold' },
  // @Character — warm brown/amber
  { tag: tags.variableName, color: '#9c4221', fontWeight: 'bold' },
  // Dialogue — dark ink, slightly indented feel via color
  { tag: tags.labelName, color: '#2a3568' },
  // Parenthetical — muted gray-green
  { tag: tags.string, color: '#5a7a4a', fontStyle: 'italic' },
  // >> Transition / centered — medium blue-gray
  { tag: tags.operator, color: '#4a5a7a', fontWeight: 'bold' },
  // ~ Lyrics — purple
  { tag: tags.meta, color: '#6b46c1' },
  // [[ Note ]] / <!-- comment --> — gray
  { tag: tags.comment, color: '#9ca3af', fontStyle: 'italic' },
  // & metadata key — teal
  { tag: tags.attributeName, color: '#0694a2' },
  // Frontmatter values — muted
  { tag: tags.attributeValue, color: '#6b7280' },
  // === page break, sigils — light gray
  { tag: tags.punctuation, color: '#9ca3af' },
])

export function SourceView() {
  const { text, setText } = useDocument()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Track externally-driven text so we don't feed our own updates back
  const lastTextRef = useRef(text)

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: text,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          sutraLanguage,
          sutraTheme,
          syntaxHighlighting(sutraHighlight),
          sourceFindHighlightExtension,
          EditorView.lineWrapping,
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              const newText = update.state.doc.toString()
              lastTextRef.current = newText
              setText(newText)
            }
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    setSourceView(view)
    return () => {
      setSourceView(null)
      view.destroy()
      viewRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external text changes (e.g. switching back from formatted view)
  useEffect(() => {
    const view = viewRef.current
    if (!view || text === lastTextRef.current) return
    lastTextRef.current = text
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    })
  }, [text])

  return <div ref={containerRef} className="cs-source-view" />
}
