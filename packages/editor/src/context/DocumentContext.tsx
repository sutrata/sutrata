import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { parse, importFountain, fountainDocToSutra } from '@sutra/parser'
import type { DocumentNode } from '@sutra/parser'
import type { EditorMode, VersionEntry } from '../types'
import { StorageAdapterProvider } from '../extensions/storage-adapter'
import type { StorageAdapter } from '../extensions/storage-adapter'
import { importDocx as importDocxToSutra } from '../file/docx-importer'
import { runCommand, getEditorView } from '../editor/editor-bus'
import { setFlatFrontmatterField } from '../editor/frontmatter-field'
import { makeSetBlock } from '../shell/toolbar-actions'
import { setTranslitMode as pluginSetTranslit } from '../editor/transliterate-input'
import { resolveStyle } from '../styles/registry'
import type { ScreenplayStyleDefinition } from '../styles/types'

import type { ConfirmOptions } from '../shell/ConfirmDialog'
import type { ToastItem } from '../shell/Toast'

export type FindMode = 'find' | 'replace'

interface DocumentContextValue {
  text: string
  ast: DocumentNode
  mode: EditorMode
  filePath: string | null
  isDirty: boolean
  lastSaveTarget: 'file' | 'local' | null
  ribbonVisible: boolean
  navVisible: boolean
  exportVisible: boolean
  settingsVisible: boolean
  aiOnboardingVisible: boolean
  voiceActive: boolean
  metadataVisible: boolean
  translitMode: boolean
  findReplaceVisible: boolean
  findMode: FindMode
  styleVisible: boolean
  customStyles: ScreenplayStyleDefinition[]
  resolvedStyle: ScreenplayStyleDefinition
  watermarkText: string | null
  confirmModal: ConfirmOptions | null
  toasts: ToastItem[]
  versions: VersionEntry[]
  versionHistoryVisible: boolean
  setText: (next: string) => void
  setMode: (mode: EditorMode) => void
  setFilePath: (path: string | null) => void
  setRibbonVisible: (v: boolean) => void
  setNavVisible: (v: boolean) => void
  setExportVisible: (v: boolean) => void
  setSettingsVisible: (v: boolean) => void
  setAIOnboardingVisible: (v: boolean) => void
  setVoiceActive: (v: boolean) => void
  setMetadataVisible: (v: boolean) => void
  setTranslitMode: (enabled: boolean) => void
  setFindReplaceVisible: (visible: boolean) => void
  setFindMode: (mode: FindMode) => void
  setStyleVisible: (v: boolean) => void
  setVersionHistoryVisible: (v: boolean) => void
  setDocumentStyle: (id: string) => void
  reloadCustomStyles: () => Promise<void>
  markClean: () => void
  save: () => Promise<void>
  newDocument: (initialContent?: string) => void
  openFile: () => Promise<void>
  saveFile: () => Promise<void>
  saveFileAs: () => Promise<void>
  importDocx: () => Promise<string[] | null>
  restoreVersion: (entry: VersionEntry) => void
  clearVersionHistory: () => Promise<void>
  showConfirm: (options: ConfirmOptions) => void
  closeConfirm: () => void
  showToast: (message: string, type?: 'info' | 'success' | 'warn' | 'error') => void
  dismissToast: (id: string) => void
}

const DocumentContext = createContext<DocumentContextValue | null>(null)

const EMPTY_DOC = '## Scene 1\n\nAction.\n'

// Points at whichever autosave key (a real filePath, or '__autosave__' for an
// untitled doc) currently holds unsaved-but-not-yet-file-saved content, so a
// reload can find it. Cleared once the content is genuinely saved to a file.
const RECOVERY_POINTER_KEY = 'sutrata:recovery-pointer'
// A save fires shortly after the user pauses...
const AUTOSAVE_PAUSE_MS = 3_000
// ...and unconditionally at this interval even if they never pause (previously
// this was a pure 30s debounce that never fired while the user kept typing).
const AUTOSAVE_MAX_WAIT_MS = 30_000

interface RecoveryPointer { path: string; updatedAt: number }

function readRecoveryPointer(): RecoveryPointer | null {
  try {
    const raw = localStorage.getItem(RECOVERY_POINTER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RecoveryPointer>
    if (typeof parsed.path !== 'string' || typeof parsed.updatedAt !== 'number') return null
    return parsed as RecoveryPointer
  } catch {
    return null
  }
}

function writeRecoveryPointer(path: string): void {
  try {
    localStorage.setItem(RECOVERY_POINTER_KEY, JSON.stringify({ path, updatedAt: Date.now() }))
  } catch {
    // localStorage unavailable (private browsing, quota) — recovery just won't work this session.
  }
}

function clearRecoveryPointer(): void {
  try {
    localStorage.removeItem(RECOVERY_POINTER_KEY)
  } catch {
    // ignore
  }
}

export function DocumentProvider({ children, storageAdapter }: { children: React.ReactNode; storageAdapter: StorageAdapter }) {
  const [text, setTextState] = useState(EMPTY_DOC)
  const [ast, setAst] = useState<DocumentNode>(() => parse(EMPTY_DOC))
  const [mode, setMode] = useState<EditorMode>('formatted')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  // Which of the two "clean" states applies once isDirty is false: written to a
  // real file the user picked, or only backed up in this browser's autosave
  // store. null = a never-touched, never-saved document (nothing to lose yet).
  const [lastSaveTarget, setLastSaveTarget] = useState<'file' | 'local' | null>(null)
  const [ribbonVisible, setRibbonVisible] = useState(true)
  const [navVisible, setNavVisible] = useState(() => window.innerWidth > 640)
  const [exportVisible, setExportVisible] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [aiOnboardingVisible, setAIOnboardingVisible] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [metadataVisible, setMetadataVisible] = useState(true)
  const [translitMode, setTranslitModeState] = useState(false)
  const [findReplaceVisible, setFindReplaceVisible] = useState(false)
  const [findMode, setFindMode] = useState<FindMode>('find')
  const [styleVisible, setStyleVisible] = useState(false)
  const [customStyles, setCustomStyles] = useState<ScreenplayStyleDefinition[]>([])
  const [confirmModal, setConfirmModal] = useState<ConfirmOptions | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [versionHistoryVisible, setVersionHistoryVisible] = useState(false)

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setConfirmModal(options)
  }, [])

  const closeConfirm = useCallback(() => {
    setConfirmModal(null)
  }, [])

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Opaque handle from the StorageAdapter's File System Access-style open/save
  // (unknown on purpose — see extensions/storage-adapter.ts) letting saveFile()
  // write back in place instead of prompting Save As every time.
  const fileHandleRef = useRef<unknown>(null)

  // isDirtyRef is updated synchronously by setDirty() below, everywhere isDirty
  // changes — not via a useEffect syncing off the `isDirty` state, which would lag
  // a render+commit behind and race anything (like the close-guard) that checks
  // "did that save actually succeed?" right after calling setDirty in the same tick.
  const isDirtyRef = useRef(false)
  const setDirty = useCallback((value: boolean) => {
    isDirtyRef.current = value
    setIsDirty(value)
  }, [])

  const reloadCustomStyles = useCallback(async () => {
    try {
      setCustomStyles(await storageAdapter.loadAllStyles())
    } catch {
      // IndexedDB unavailable (private browsing, test environment, etc.) — fall
      // back to built-in styles only rather than crashing the app.
      setCustomStyles([])
    }
  }, [storageAdapter])

  useEffect(() => { void reloadCustomStyles() }, [reloadCustomStyles])

  // Recover autosaved-but-unsaved content on boot (Ctrl-R, a crash, or the tab closing
  // without an explicit save) instead of always starting from a blank document.
  useEffect(() => {
    const pointer = readRecoveryPointer()
    if (!pointer) return
    let cancelled = false
    void (async () => {
      try {
        const content = await storageAdapter.loadDocument(pointer.path)
        if (cancelled || !content) return
        setTextState(content)
        setAst(parse(content))
        setFilePath(pointer.path === '__autosave__' ? null : pointer.path)
        setDirty(true)
        // Still marked dirty above regardless — a restored draft isn't confirmed
        // written back until the user actually saves it again.
        if (pointer.path !== '__autosave__') {
          const handle = await storageAdapter.restoreFileHandle?.(pointer.path)
          if (!cancelled && handle) fileHandleRef.current = handle
        }
        showToast('Recovered unsaved changes from your last session.', 'info')
      } catch {
        // Best-effort recovery; fall back to the empty template on failure.
      }
    })()
    return () => { cancelled = true }
  }, [storageAdapter, showToast])

  const setText = useCallback((next: string) => {
    setTextState(next)
    setAst(parse(next))
    setDirty(true)
  }, [])

  const setTranslitMode = useCallback((enabled: boolean) => {
    setTranslitModeState(enabled)
    pluginSetTranslit(enabled, 'hi') // default to Hindi; will use LanguageContext in production
  }, [])

  const frontmatterData = ast.frontmatter?.data as Record<string, unknown> | undefined
  const documentStyleId = frontmatterData?.['style'] as string | undefined
  const resolvedStyle = useMemo(
    () => resolveStyle(documentStyleId, customStyles),
    [documentStyleId, customStyles],
  )
  const watermarkRaw = frontmatterData?.['watermark']
  const watermarkText = typeof watermarkRaw === 'string' && watermarkRaw.trim() ? watermarkRaw.trim() : null

  const setDocumentStyle = useCallback((id: string) => {
    setFlatFrontmatterField(getEditorView(), text, setText, 'style', id)
  }, [text, setText])

  const markClean = useCallback(() => setDirty(false), [])

  // Refs so the autosave path always writes the latest text/filePath without
  // needing them in a dependency array that would tear down the timers below
  // on every keystroke.
  const textRef = useRef(text)
  useEffect(() => { textRef.current = text }, [text])
  const filePathRef = useRef(filePath)
  useEffect(() => { filePathRef.current = filePath }, [filePath])
  const autosaveFailedRef = useRef(false)

  const save = useCallback(async () => {
    const path = filePathRef.current ?? '__autosave__'
    try {
      await storageAdapter.saveDocument(path, textRef.current)
      writeRecoveryPointer(path)
      setDirty(false)
      setLastSaveTarget('local')
      autosaveFailedRef.current = false
    } catch {
      if (!autosaveFailedRef.current) {
        autosaveFailedRef.current = true
        showToast('Autosave failed — your browser storage may be full or unavailable.', 'warn')
      }
    }
  }, [storageAdapter, showToast])

  const newDocument = useCallback((initialContent?: string) => {
    const doNew = () => {
      if (pauseTimerRef.current) { clearTimeout(pauseTimerRef.current); pauseTimerRef.current = null }
      if (maxWaitTimerRef.current) { clearTimeout(maxWaitTimerRef.current); maxWaitTimerRef.current = null }
      dirtySinceRef.current = null
      fileHandleRef.current = null
      clearRecoveryPointer()
      const content = initialContent ?? EMPTY_DOC
      setTextState(content)
      setAst(parse(content))
      setFilePath(null)
      setDirty(false)
      setLastSaveTarget(null)
      setVersions([])
    }

    if (!isDirty) {
      doNew()
      return
    }

    showConfirm({
      title: 'Discard Unsaved Changes?',
      message: 'Starting a new screenplay will discard all unsaved edits to your current document.',
      confirmLabel: 'Discard & Create New',
      destructive: true,
      onConfirm: doNew,
    })
  }, [isDirty, showConfirm])

  const openFile = useCallback(async () => {
    const doOpen = async () => {
      const result = await storageAdapter.openFile()
      if (!result) return
      if (pauseTimerRef.current) { clearTimeout(pauseTimerRef.current); pauseTimerRef.current = null }
      if (maxWaitTimerRef.current) { clearTimeout(maxWaitTimerRef.current); maxWaitTimerRef.current = null }
      dirtySinceRef.current = null
      clearRecoveryPointer()
      let content = result.content
      const isFountain = result.name.endsWith('.fountain')
      if (isFountain) {
        const { document } = importFountain(content)
        content = fountainDocToSutra(document)
      }
      const parsed = parse(content)
      if (!parsed.frontmatter) {
        const baseName = result.name.replace(/\.[^.]+$/, '')
        content = `---\ntitle: ${baseName}\n---\n\n${content}`
      }
      // Fountain files get no handle (we save as .sutra); .sutra files keep their handle
      fileHandleRef.current = isFountain ? null : (result.handle ?? null)
      const newPath = result.name.replace(/\.fountain$/i, '.sutra')
      setTextState(content)
      setAst(parse(content))
      setFilePath(newPath)
      // Opening a file is a clean state; fountain conversion counts as dirty since format changed
      setDirty(isFountain)
      setLastSaveTarget(isFountain ? null : 'file')
      if (!isFountain && fileHandleRef.current) {
        void storageAdapter.persistFileHandle?.(newPath, fileHandleRef.current)
      }
    }

    if (!isDirty) {
      await doOpen()
      return
    }

    await new Promise<void>((resolve) => {
      showConfirm({
        title: 'Discard Unsaved Changes?',
        message: 'Opening a different screenplay will discard any unsaved edits to your current document.',
        confirmLabel: 'Discard & Open',
        destructive: true,
        onConfirm: () => { void doOpen().then(resolve) },
        onCancel: () => resolve(),
      })
    })
  }, [storageAdapter, isDirty, showConfirm])

  // Power-user feature: versions are captured only on explicit saveFile/saveFileAs
  // (never on autosave — see save() above). Called both by the filePath-change
  // effect below and directly after a save that reuses the same filePath (which
  // wouldn't otherwise re-trigger that effect).
  const refreshVersions = useCallback(async (path: string) => {
    try {
      const loaded = await storageAdapter.listVersions(path)
      setVersions(loaded)
    } catch {
      // silently fail if storage unavailable
    }
  }, [storageAdapter])

  const saveFile = useCallback(async () => {
    const name = filePath ?? 'untitled.sutra'
    const result = await storageAdapter.saveFile(name, text, fileHandleRef.current)
    if (result) {
      fileHandleRef.current = result.handle
      setFilePath(result.savedName)
      setDirty(false)
      setLastSaveTarget('file')
      clearRecoveryPointer()
      if (result.handle) void storageAdapter.persistFileHandle?.(result.savedName, result.handle)
      void refreshVersions(result.savedName)
      showToast(`Saved ${result.savedName}`, 'success')
    }
  }, [filePath, text, showToast, storageAdapter, refreshVersions])

  const saveFileAs = useCallback(async () => {
    const name = filePath ?? 'untitled.sutra'
    const result = await storageAdapter.saveFile(name, text, null)
    if (result) {
      fileHandleRef.current = result.handle
      setFilePath(result.savedName)
      setDirty(false)
      setLastSaveTarget('file')
      clearRecoveryPointer()
      if (result.handle) void storageAdapter.persistFileHandle?.(result.savedName, result.handle)
      void refreshVersions(result.savedName)
      showToast(`Saved as ${result.savedName}`, 'success')
    }
  }, [filePath, text, showToast, storageAdapter, refreshVersions])

  // Reimports a .docx previously exported via exportToDocx (optionally corrected/proofread
  // in Word — the exporter's CineXxx paragraph styles are what makes the round trip possible;
  // font-only changes don't affect them). Returns null if the user cancelled the file picker
  // or declined the replace-content confirmation; otherwise the import warnings (possibly empty).
  const importDocx = useCallback(async (): Promise<string[] | null> => {
    const picked = await storageAdapter.openDocx()
    if (!picked) return null
    const { bodyText, warnings } = await importDocxToSutra(picked.buffer)
    if (bodyText === null) return warnings
    return new Promise((resolve) => {
      showConfirm({
        title: 'Import Word Document',
        message: 'Replace the current screenplay content with the imported Word document? This cannot be undone.',
        confirmLabel: 'Replace Screenplay',
        destructive: true,
        onConfirm: () => {
          const frontmatterRaw = ast.frontmatter?.raw
          const newText = frontmatterRaw ? `${frontmatterRaw}\n${bodyText}\n` : `${bodyText}\n`
          setText(newText)
          showToast('Word document imported successfully', 'success')
          resolve(warnings)
        },
        onCancel: () => resolve(null),
      })
    })
  }, [ast, setText, showConfirm, showToast])

  // Power-user feature: versions are captured only on explicit saveFile/saveFileAs
  // (never on autosave — see save() above), so this needs an explicit refresh
  // after each of those succeed, not just when filePath changes.
  useEffect(() => {
    if (!filePath) {
      setVersions([])
      return
    }
    void refreshVersions(filePath)
  }, [filePath, refreshVersions])

  const restoreVersion = useCallback((entry: VersionEntry) => {
    setText(entry.content) // setText already marks the document dirty
    setVersionHistoryVisible(false)
    showToast('Version restored — remember to save.', 'info')
  }, [setText, showToast])

  const clearVersionHistory = useCallback(async () => {
    if (!filePath) return
    return new Promise<void>((resolve) => {
      showConfirm({
        title: 'Delete Version History?',
        message: `Delete all ${versions.length} saved versions of ${filePath}? This cannot be undone.`,
        confirmLabel: 'Delete Version History',
        destructive: true,
        onConfirm: async () => {
          try {
            await storageAdapter.deleteAllVersions?.(filePath)
            setVersions([])
            showToast('Version history cleared', 'success')
          } catch {
            showToast('Failed to clear version history', 'error')
          }
          resolve()
        },
        onCancel: () => resolve(),
      })
    })
  }, [filePath, versions.length, showConfirm, showToast, storageAdapter])

  // Autosave: a short pause after the last keystroke triggers a save, and a hard
  // ceiling (AUTOSAVE_MAX_WAIT_MS) forces one regardless, so a long uninterrupted
  // typing session is never more than ~30s away from a recoverable backup.
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtySinceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isDirty) {
      if (pauseTimerRef.current) { clearTimeout(pauseTimerRef.current); pauseTimerRef.current = null }
      if (maxWaitTimerRef.current) { clearTimeout(maxWaitTimerRef.current); maxWaitTimerRef.current = null }
      dirtySinceRef.current = null
      return
    }

    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    pauseTimerRef.current = setTimeout(() => { void save() }, AUTOSAVE_PAUSE_MS)

    // Only armed once per dirty streak — NOT reset on every keystroke — so it
    // actually acts as a ceiling instead of an ever-postponed debounce.
    if (dirtySinceRef.current === null) {
      dirtySinceRef.current = Date.now()
      maxWaitTimerRef.current = setTimeout(() => { void save() }, AUTOSAVE_MAX_WAIT_MS)
    }

    return () => {
      if (pauseTimerRef.current) { clearTimeout(pauseTimerRef.current); pauseTimerRef.current = null }
    }
  }, [text, isDirty, save])

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
      if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current)
    }
  }, [])

  // beforeunload guard — fires on page reload, window close, Electron reload
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = 'You have unsaved changes.'
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const cs  = mod && e.shiftKey

      // File operations — use e.code for layout-independence
      if (mod && !e.shiftKey && !e.altKey && e.code === 'KeyS') {
        e.preventDefault(); void saveFile(); return
      }
      if (mod && !e.shiftKey && !e.altKey && e.code === 'KeyO') {
        e.preventDefault(); void openFile(); return
      }
      if (mod && !e.shiftKey && !e.altKey && e.code === 'KeyF') {
        e.preventDefault()
        setFindMode('find')
        setFindReplaceVisible(v => !v)
        return
      }
      if (mod && !e.shiftKey && !e.altKey && e.code === 'KeyH') {
        e.preventDefault()
        setFindMode('replace')
        setFindReplaceVisible(true)
        return
      }

      // Block type shortcuts  Alt+Shift+letter
      if (e.altKey && e.shiftKey && !mod) {
        const blockMap: Record<string, Parameters<typeof makeSetBlock>> = {
          'KeyH': ['scene_heading', { id: null }],
          'KeyA': ['action'],
          'KeyC': ['character', { extension: null, isDual: false }],
          'KeyD': ['dialogue'],
          'KeyP': ['parenthetical'],
          'KeyX': ['transition'],
          'KeyN': ['note'],
        }
        if (e.code in blockMap) {
          e.preventDefault()
          const [type, attrs] = blockMap[e.code]!
          runCommand(makeSetBlock(type, attrs ?? {}))
          return
        }
      }

      // UI toggles  Ctrl+Shift+letter
      if (cs && !e.altKey) {
        if (e.code === 'KeyE') { e.preventDefault(); setMode(m => m === 'formatted' ? 'source' : 'formatted'); return }
        if (e.code === 'KeyH') { e.preventDefault(); setRibbonVisible(v => !v); return }  // was KeyR
        if (e.code === 'KeyB') { e.preventDefault(); setNavVisible(v => !v); return }
        if (e.code === 'KeyK') { e.preventDefault(); setTranslitMode(!translitMode); return }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveFile, openFile, translitMode, setTranslitMode])

  // Native menu IPC (Desktop wrapper only) — receives commands from the main process menu
  useEffect(() => {
    const api = window.desktopAPI
    if (!api?.onMenuCommand) return
    const off = api.onMenuCommand((cmd) => {
      switch (cmd) {
        case 'file:new':
          newDocument(EMPTY_DOC)
          break
        case 'file:open':    void openFile();   break
        case 'file:save':    void saveFile();   break
        case 'file:saveAs':  void saveFileAs(); break
        case 'edit:find':
          setFindMode('find'); setFindReplaceVisible(true); break
        case 'edit:replace':
          setFindMode('replace'); setFindReplaceVisible(true); break
        case 'edit:toggleSource':
          setMode(m => m === 'formatted' ? 'source' : 'formatted'); break
        case 'edit:toggleRibbon':
          setRibbonVisible(v => !v); break
        case 'edit:toggleNav':
          setNavVisible(v => !v); break
        case 'edit:toggleTranslit':
          setTranslitMode(!translitMode); break
        case 'edit:toggleMetadata':
          setMetadataVisible(!metadataVisible); break
      }
    })
    return off
  }, [isDirty, newDocument, openFile, saveFile, saveFileAs, setText, setMode, setRibbonVisible, setNavVisible, setTranslitMode, translitMode, metadataVisible, showConfirm])

  // Native window-close guard (Desktop wrapper only). beforeunload isn't reliable for
  // an OS-level close across Tauri's backing webviews, so the Rust side intercepts it
  // and asks here instead; nothing to close until we say so via closeWindow().
  useEffect(() => {
    const api = window.desktopAPI
    if (!api?.onCloseRequested) return
    const off = api.onCloseRequested(() => {
      if (!isDirtyRef.current) {
        void api.closeWindow?.()
        return
      }
      showConfirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Save them before closing?',
        confirmLabel: 'Save & Close',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          void saveFile().then(() => {
            // saveFile only clears isDirty on success — if the user cancelled a
            // Save As picker or it failed, stay open instead of closing anyway.
            if (!isDirtyRef.current) void api.closeWindow?.()
          })
        },
        // onCancel omitted — dismissing just leaves the window open.
      })
    })
    return off
  }, [saveFile, showConfirm])

  return (
    <StorageAdapterProvider value={storageAdapter}>
      <DocumentContext.Provider value={{
        text, ast, mode, filePath, isDirty, lastSaveTarget, ribbonVisible, navVisible, exportVisible, settingsVisible,
        aiOnboardingVisible, voiceActive, metadataVisible,
        translitMode, findReplaceVisible, findMode, styleVisible, customStyles, resolvedStyle, watermarkText,
        confirmModal, toasts, versions, versionHistoryVisible,
        setText, setMode, setFilePath, setRibbonVisible, setNavVisible, setExportVisible, setSettingsVisible,
        setAIOnboardingVisible, setVoiceActive, setMetadataVisible,
        setTranslitMode, setFindReplaceVisible, setFindMode, setStyleVisible, setVersionHistoryVisible, setDocumentStyle, reloadCustomStyles,
        markClean, save, newDocument, openFile, saveFile, saveFileAs, importDocx, restoreVersion, clearVersionHistory,
        showConfirm, closeConfirm, showToast, dismissToast,
      }}>
        {children}
      </DocumentContext.Provider>
    </StorageAdapterProvider>
  )
}

export function useDocument() {
  const ctx = useContext(DocumentContext)
  if (!ctx) throw new Error('useDocument must be used inside DocumentProvider')
  return ctx
}
