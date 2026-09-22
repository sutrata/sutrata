import React, { useEffect, useState } from 'react'
import { AppBar } from './AppBar'
import { ElementToolbar } from './ElementToolbar'
import { StatusBar } from './StatusBar'
import { EditorView } from '../editor/EditorView'
import { SourceView } from '../source/SourceView'
import { useDocument } from '../context/DocumentContext'
import { SceneNavigator } from '../navigator/SceneNavigator'
import { FindReplace } from '../findreplace/FindReplace'
import { ExportDialog } from '../titlepage/ExportDialog'
import { TitlePageDialog, OPEN_TITLE_PAGE_EVENT } from '../titlepage/TitlePageDialog'
import { SettingsDialog } from '../settings/SettingsDialog'
import { StyleDialog } from '../styles/StyleDialog'
import { Watermark } from './Watermark'
import { ConfirmDialog } from './ConfirmDialog'
import { ToastContainer } from './Toast'
import { VoiceToolbar } from '../ai/VoiceToolbar'
import { OnboardingDialog } from '../ai/OnboardingDialog'
import { SelectionMenu } from '../editor/SelectionMenu'

export function AppShell() {
  const {
    mode, ribbonVisible, navVisible, setNavVisible, exportVisible, settingsVisible,
    setSettingsVisible, styleVisible, setStyleVisible, metadataVisible,
    voiceActive, aiOnboardingVisible, setAIOnboardingVisible,
    confirmModal, closeConfirm, toasts, dismissToast,
  } = useDocument()
  const [titlePageVisible, setTitlePageVisible] = useState(false)

  useEffect(() => {
    const open = () => setTitlePageVisible(true)
    window.addEventListener(OPEN_TITLE_PAGE_EVENT, open)
    return () => window.removeEventListener(OPEN_TITLE_PAGE_EVENT, open)
  }, [])

  return (
    <div className={`cs-shell ${metadataVisible ? '' : 'cs-hide-metadata'}`}>
      <Watermark />
      <AppBar />
      {voiceActive && <VoiceToolbar />}
      {ribbonVisible && <ElementToolbar />}
      <div className="cs-shell-body">
        {navVisible && (
          <>
            <div
              className="cs-nav-backdrop"
              aria-hidden="true"
              onClick={() => setNavVisible(false)}
            />
            <SceneNavigator />
          </>
        )}
        <div className="cs-editor-area">
          <main className="cs-main">
            {mode === 'formatted' ? <EditorView /> : <SourceView />}
          </main>
        </div>
      </div>
      <StatusBar />
      <FindReplace />
      {exportVisible && <ExportDialog />}
      {titlePageVisible && <TitlePageDialog onClose={() => setTitlePageVisible(false)} />}
      {settingsVisible && <SettingsDialog onClose={() => setSettingsVisible(false)} />}
      {styleVisible && <StyleDialog onClose={() => setStyleVisible(false)} />}
      {aiOnboardingVisible && <OnboardingDialog onClose={() => setAIOnboardingVisible(false)} />}
      {confirmModal && <ConfirmDialog options={confirmModal} onClose={closeConfirm} />}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <SelectionMenu />
    </div>
  )
}
