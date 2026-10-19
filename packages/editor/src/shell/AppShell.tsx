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
import { useSpeech } from '../extensions/speech-provider'
import { useCanEdit, useSession, isFeatureEnabled } from '../extensions/session'
import { usePanels } from '../extensions/panel-registry'
import { usePanelContext } from './use-panel-context'
import { useTranslation } from '../i18n/useTranslation'
import { SelectionMenu } from '../editor/SelectionMenu'

/** The built-in Scenes tab's icon: a list. */
const NavigatorTabIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />
  </svg>
)

export function AppShell() {
  const {
    mode, ribbonVisible, navVisible, setNavVisible, exportVisible, settingsVisible,
    setSettingsVisible, styleVisible, setStyleVisible, metadataVisible,
    voiceActive,
    confirmModal, closeConfirm, toasts, dismissToast,
  } = useDocument()
  const [titlePageVisible, setTitlePageVisible] = useState(false)
  const speech = useSpeech()
  const canEdit = useCanEdit()
  const canExport = isFeatureEnabled(useSession(), 'export')
  const { t } = useTranslation()
  const panelContext = usePanelContext()
  // The scene navigator is the built-in first sidebar tab; embedder sidebar
  // panels become further tabs. Inspector panels stack on the right.
  const sidebarPanels = usePanels('sidebar')
  const inspectorPanels = usePanels('inspector')
  const [sidebarTab, setSidebarTab] = useState('navigator')
  const activeSidebar = sidebarPanels.find(p => p.id === sidebarTab)

  // A panel that shows the title page form replaces the dialog.
  const titlePageInPanel = inspectorPanels.some(p => p.handlesTitlePage)
  useEffect(() => {
    if (titlePageInPanel) return
    const open = () => setTitlePageVisible(true)
    window.addEventListener(OPEN_TITLE_PAGE_EVENT, open)
    return () => window.removeEventListener(OPEN_TITLE_PAGE_EVENT, open)
  }, [titlePageInPanel])

  return (
    <div className={`cs-shell ${metadataVisible ? '' : 'cs-hide-metadata'}`}>
      <Watermark />
      <AppBar />
      {voiceActive && speech && <VoiceToolbar />}
      {ribbonVisible && canEdit && <ElementToolbar />}
      <div className="cs-shell-body">
        {navVisible && (
          <>
            <div
              className="cs-nav-backdrop"
              aria-hidden="true"
              onClick={() => setNavVisible(false)}
            />
            {sidebarPanels.length === 0 ? (
              <SceneNavigator />
            ) : (
              <div className="cs-sidebar">
                <div className="cs-sidebar-tabs" role="tablist" aria-label={t('shell.sidebar')}>
                  {[{ id: 'navigator', title: t('navigator.title'), icon: <NavigatorTabIcon /> as React.ReactNode }, ...sidebarPanels].map(p => {
                    const active = (activeSidebar?.id ?? 'navigator') === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-label={p.icon ? p.title : undefined}
                        title={p.icon ? p.title : undefined}
                        className={`cs-sidebar-tab${active ? ' cs-sidebar-tab-active' : ''}`}
                        onClick={e => { setSidebarTab(p.id); e.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }) }}
                      >
                        {p.icon}
                        {(!p.icon || active) && <span className="cs-sidebar-tab-label">{p.title}</span>}
                      </button>
                    )
                  })}
                </div>
                {activeSidebar ? (
                  <div className="cs-sidebar-panel" role="tabpanel" aria-label={activeSidebar.title}>
                    {activeSidebar.render(panelContext)}
                  </div>
                ) : (
                  <SceneNavigator />
                )}
              </div>
            )}
          </>
        )}
        <div className="cs-editor-area">
          <main className="cs-main">
            {mode === 'formatted' ? <EditorView /> : <SourceView />}
          </main>
        </div>
        {inspectorPanels.length > 0 && (
          <aside className="cs-inspector" aria-label={t('shell.inspector')}>
            {inspectorPanels.map(p => (
              <section key={p.id} className="cs-inspector-section" aria-label={p.title}>
                <div className="cs-inspector-title">{p.title}</div>
                {p.render(panelContext)}
              </section>
            ))}
          </aside>
        )}
      </div>
      <StatusBar />
      <FindReplace />
      {exportVisible && canExport && <ExportDialog />}
      {titlePageVisible && canEdit && <TitlePageDialog onClose={() => setTitlePageVisible(false)} />}
      {settingsVisible && <SettingsDialog onClose={() => setSettingsVisible(false)} />}
      {styleVisible && canEdit && <StyleDialog onClose={() => setStyleVisible(false)} />}
      {confirmModal && <ConfirmDialog options={confirmModal} onClose={closeConfirm} />}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {canEdit && <SelectionMenu />}
    </div>
  )
}
