import React, { useEffect, useRef } from 'react'
import { EditorState } from 'prosemirror-state'
import { EditorView as PmEditorView } from 'prosemirror-view'
import { parse } from '@sutrata/parser'
import { schema } from './schema'
import { buildPlugins } from './plugins'
import { sutraToProsemirror } from './sutra-to-prosemirror'
import { prosemirrorToSutra } from './prosemirror-to-sutra'
import { setEditorView, emit } from './editor-bus'
import { useDocument } from '../context/DocumentContext'
import { SceneHeadingView } from './scene-heading-view'
import { FrontmatterFieldView } from './frontmatter-field-view'
import { applyStyleVars } from '../styles/css-adapter'
import { useCanEdit } from '../extensions/session'

export function EditorView() {
  const { text, setText, resolvedStyle } = useDocument()
  // Read-only sessions: not editable, and every doc-changing transaction —
  // typed, or dispatched by a toolbar/navigator/node view — is dropped here.
  const canEdit = useCanEdit()
  const canEditRef = useRef(canEdit)
  canEditRef.current = canEdit
  const mountRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<PmEditorView | null>(null)
  const textRef = useRef(text)
  textRef.current = text
  // When true, the next text change originated from the editor itself —
  // the sync effect must skip it to avoid clobbering in-flight transactions.
  const selfChangeRef = useRef(false)

  // Mount once: create ProseMirror view
  useEffect(() => {
    if (!mountRef.current) return

    const doc = sutraToProsemirror(parse(textRef.current))
    const state = EditorState.create({ doc, schema, plugins: buildPlugins() })

    const view = new PmEditorView(mountRef.current, {
      state,
      nodeViews: {
        scene_heading: (node, view, getPos) => new SceneHeadingView(node, view, getPos),
        frontmatter_field: (node, view, getPos) => new FrontmatterFieldView(node, view, getPos),
      },
      editable: () => canEditRef.current,
      dispatchTransaction(tr) {
        if (tr.docChanged && !canEditRef.current) return
        const newState = view.state.apply(tr)
        view.updateState(newState)
        if (tr.docChanged) {
          const newText = prosemirrorToSutra(newState.doc)
          if (newText !== textRef.current) {
            selfChangeRef.current = true
            setText(newText)
          }
        }
        emit()
      },
    })
    viewRef.current = view
    setEditorView(view)

    return () => { setEditorView(null); view.destroy(); viewRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external text changes into ProseMirror (e.g. switching from source mode).
  // Skip when the editor itself produced the change — it already has the right state.
  useEffect(() => {
    if (selfChangeRef.current) {
      selfChangeRef.current = false
      return
    }
    const view = viewRef.current
    if (!view) return
    const currentText = prosemirrorToSutra(view.state.doc)
    if (currentText !== text) {
      const doc = sutraToProsemirror(parse(text))
      const state = EditorState.create({ doc, schema, plugins: buildPlugins() })
      view.updateState(state)
    }
  }, [text])

  // Re-evaluate `editable` when the session's permission changes.
  useEffect(() => {
    viewRef.current?.setProps({})
  }, [canEdit])

  // Apply the document's resolved style as CSS custom properties on the mount element.
  // Works identically for built-in and user-imported styles — both are plain
  // ScreenplayStyleDefinition objects by the time they reach here.
  useEffect(() => {
    if (mountRef.current) applyStyleVars(mountRef.current, resolvedStyle)
  }, [resolvedStyle])

  return <div ref={mountRef} className="cs-editor-mount" />
}
