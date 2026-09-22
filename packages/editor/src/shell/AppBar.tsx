import React, { useState } from 'react'
import { useDocument } from '../context/DocumentContext'
import { useTranslation } from '../i18n/useTranslation'
import {
  NavigatorIcon, TitlePageIcon, NewIcon, OpenIcon, SaveIcon, SaveAsIcon,
  SourceIcon, FormattedIcon, RibbonIcon, ExportIcon, SettingsIcon, ImportDocxIcon, StyleIcon,
  MicIcon, MenuIcon, CloseIcon,
} from './icons'
import { SutrataLogo } from './SutrataLogo'
import { getTemplate } from '../templates/templates'
import { openTitlePageForm } from '../titlepage/TitlePageDialog'

interface AbBtnProps {
  label: string
  shortcut?: string
  active?: boolean
  variant?: 'primary' | 'secondary'
  onClick: () => void
  children: React.ReactNode
}

function AbBtn({ label, shortcut, active, variant, onClick, children }: AbBtnProps) {
  const variantClass = variant === 'primary' ? ' cs-ab-btn-primary' : variant === 'secondary' ? ' cs-ab-btn-secondary' : ''
  return (
    <button
      type="button"
      aria-label={label}
      className={`cs-ab-btn${active ? ' cs-ab-active' : ''}${variantClass}`}
      onClick={onClick}
    >
      {children}
      <span className="cs-tb-tip" role="tooltip">
        <span>{label}</span>
        {shortcut ? <span className="cs-tb-key">{shortcut}</span> : null}
      </span>
    </button>
  )
}

export function AppBar() {
  const {
    mode, setMode, isDirty, filePath, ribbonVisible, setRibbonVisible,
    navVisible, setNavVisible, exportVisible, setExportVisible,
    settingsVisible, setSettingsVisible, metadataVisible, setMetadataVisible,
    translitMode, setTranslitMode, voiceActive, setVoiceActive, newDocument, openFile, saveFile, saveFileAs, setText,
    importDocx, styleVisible, setStyleVisible, showConfirm, showToast,
  } = useDocument()
  const { t, locale } = useTranslation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const name = filePath ?? 'untitled.sutra'
  const nextMode = mode === 'formatted' ? 'source' : 'formatted'

  const handleNew = () => {
    newDocument(getTemplate(locale))
  }

  const handleImportDocx = async () => {
    try {
      const warnings = await importDocx()
      if (warnings && warnings.length) {
        showToast(warnings.join(' • '), 'warn')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import the Word document.', 'error')
    }
  }

  return (
    <header className="cs-app-bar" role="banner" aria-label="Application header">
      {/* Left zone: Brand mark, Navigator toggle, and Document identifier */}
      <div className="cs-ab-group cs-ab-left">
        <div className="cs-ab-brand" title="Sutrata Multilingual Screenplay Editor">
          <SutrataLogo size={20} showText={false} />
          <span className="cs-ab-brand-title">Sutrata</span>
        </div>
        <span className="cs-ab-sep cs-ab-desktop-only" />
        <AbBtn
          label={t('appbar.navigator')}
          shortcut="Ctrl+Shift+B"
          active={navVisible}
          onClick={() => setNavVisible(!navVisible)}
        >
          <NavigatorIcon size={18} />
        </AbBtn>
        <span className="cs-ab-desktop-only">
          <AbBtn label={t('appbar.titlePage')} onClick={openTitlePageForm}>
            <TitlePageIcon size={18} />
          </AbBtn>
        </span>
        <div className="cs-ab-file-pill" title={filePath ?? 'untitled.sutra'}>
          <span className="cs-ab-file-name">{name}</span>
          {isDirty && <span className="cs-ab-dirty" title="Unsaved edits" />}
        </div>
      </div>

      <span className="cs-ab-spacer cs-ab-desktop-only" />

      {/* Center zone: View Mode, Ribbon, Transliteration, Metadata (Desktop only) */}
      <div className="cs-ab-group cs-ab-desktop-group">
        <AbBtn
          label={mode === 'formatted' ? t('appbar.switchToSource') : t('appbar.switchToFormatted')}
          shortcut="Ctrl+Shift+E"
          onClick={() => setMode(nextMode)}
        >
          {mode === 'formatted' ? <SourceIcon size={18} /> : <FormattedIcon size={18} />}
        </AbBtn>
        <AbBtn
          label={ribbonVisible ? t('appbar.hideToolbar') : t('appbar.showToolbar')}
          shortcut="Ctrl+Shift+H"
          active={ribbonVisible}
          onClick={() => setRibbonVisible(!ribbonVisible)}
        >
          <RibbonIcon size={18} />
        </AbBtn>
        <AbBtn
          label={t('appbar.translit')}
          shortcut="Ctrl+Shift+K"
          active={translitMode}
          onClick={() => setTranslitMode(!translitMode)}
        >
          <span style={{ fontWeight: 600 }}>अ</span>
        </AbBtn>
        <AbBtn
          label="Voice Dictation"
          shortcut="Ctrl+Shift+V"
          active={voiceActive}
          onClick={() => setVoiceActive(!voiceActive)}
        >
          <MicIcon size={18} />
        </AbBtn>
        <AbBtn
          label={metadataVisible ? 'Hide Metadata' : 'Show Metadata'}
          active={metadataVisible}
          onClick={() => setMetadataVisible(!metadataVisible)}
        >
          <span style={{ fontWeight: 700, fontSize: '13px' }}>&amp;</span>
        </AbBtn>
      </div>

      <span className="cs-ab-spacer cs-ab-desktop-only" />

      {/* Right zone: File Operations, Save, Export, Settings (Desktop only) */}
      <div className="cs-ab-group cs-ab-desktop-group">
        <AbBtn label={t('appbar.new')} onClick={handleNew}>
          <NewIcon size={18} />
        </AbBtn>
        <AbBtn label={t('appbar.open')} shortcut="Ctrl+O" onClick={() => { void openFile() }}>
          <OpenIcon size={18} />
        </AbBtn>
        <AbBtn label={t('appbar.importDocx')} onClick={() => { void handleImportDocx() }}>
          <ImportDocxIcon size={18} />
        </AbBtn>
        <span className="cs-ab-sep" />
        <AbBtn
          label={t('appbar.save')}
          shortcut="Ctrl+S"
          variant="primary"
          onClick={() => { void saveFile() }}
        >
          <SaveIcon size={17} />
        </AbBtn>
        <AbBtn label={t('appbar.saveAs')} shortcut="Ctrl+Shift+S" onClick={() => { void saveFileAs() }}>
          <SaveAsIcon size={17} />
        </AbBtn>
        <span className="cs-ab-sep" />
        <AbBtn
          label={t('appbar.export')}
          variant="secondary"
          active={exportVisible}
          onClick={() => setExportVisible(!exportVisible)}
        >
          <ExportIcon size={18} />
        </AbBtn>
        <AbBtn label={t('appbar.style')} active={styleVisible} onClick={() => setStyleVisible(!styleVisible)}>
          <StyleIcon size={18} />
        </AbBtn>
        <AbBtn label={t('settings.title')} active={settingsVisible} onClick={() => setSettingsVisible(!settingsVisible)}>
          <SettingsIcon size={18} />
        </AbBtn>
      </div>

      {/* Mobile controls zone */}
      <div className="cs-ab-group cs-ab-mobile-controls">
        <AbBtn
          label={t('appbar.save')}
          variant={isDirty ? 'primary' : undefined}
          onClick={() => { void saveFile() }}
        >
          <SaveIcon size={17} />
        </AbBtn>
        <AbBtn
          label="Menu"
          active={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
        </AbBtn>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <>
          <div
            className="cs-mobile-menu-backdrop"
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className="cs-mobile-menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Application Menu"
          >
            <div className="cs-mm-header">
              <div className="cs-mm-brand">
                <SutrataLogo size={22} showText={false} />
                <span>Sutrata</span>
              </div>
              <button
                type="button"
                className="cs-mm-close"
                aria-label="Close menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="cs-mm-file-info">
              <span className="cs-mm-file-name">{name}</span>
              {isDirty && <span className="cs-ab-dirty" title="Unsaved edits" />}
            </div>

            <div className="cs-mm-section">
              <div className="cs-mm-section-title">Views &amp; Tools</div>
              <button
                type="button"
                className="cs-mm-item"
                onClick={() => { setMode(nextMode); setMobileMenuOpen(false) }}
              >
                {mode === 'formatted' ? <SourceIcon size={18} /> : <FormattedIcon size={18} />}
                <span>{mode === 'formatted' ? t('appbar.switchToSource') : t('appbar.switchToFormatted')}</span>
              </button>
              <button
                type="button"
                className={`cs-mm-item${navVisible ? ' cs-mm-active' : ''}`}
                onClick={() => { setNavVisible(!navVisible); setMobileMenuOpen(false) }}
              >
                <NavigatorIcon size={18} />
                <span>{t('appbar.navigator')}</span>
              </button>
              <button
                type="button"
                className={`cs-mm-item${ribbonVisible ? ' cs-mm-active' : ''}`}
                onClick={() => { setRibbonVisible(!ribbonVisible); setMobileMenuOpen(false) }}
              >
                <RibbonIcon size={18} />
                <span>{ribbonVisible ? t('appbar.hideToolbar') : t('appbar.showToolbar')}</span>
              </button>
              <button
                type="button"
                className={`cs-mm-item${translitMode ? ' cs-mm-active' : ''}`}
                onClick={() => { setTranslitMode(!translitMode); setMobileMenuOpen(false) }}
              >
                <span style={{ fontWeight: 700, width: 18, textAlign: 'center' }}>अ</span>
                <span>{t('appbar.translit')}</span>
              </button>
              <button
                type="button"
                className={`cs-mm-item${voiceActive ? ' cs-mm-active' : ''}`}
                onClick={() => { setVoiceActive(!voiceActive); setMobileMenuOpen(false) }}
              >
                <MicIcon size={18} />
                <span>Voice Dictation</span>
              </button>
              <button
                type="button"
                className={`cs-mm-item${metadataVisible ? ' cs-mm-active' : ''}`}
                onClick={() => { setMetadataVisible(!metadataVisible); setMobileMenuOpen(false) }}
              >
                <span style={{ fontWeight: 700, width: 18, textAlign: 'center' }}>&amp;</span>
                <span>{metadataVisible ? 'Hide Metadata' : 'Show Metadata'}</span>
              </button>
            </div>

            <div className="cs-mm-section">
              <div className="cs-mm-section-title">File Operations</div>
              <button
                type="button"
                className="cs-mm-item"
                onClick={() => { openTitlePageForm(); setMobileMenuOpen(false) }}
              >
                <TitlePageIcon size={18} />
                <span>{t('appbar.titlePage')}</span>
              </button>
              <button
                type="button"
                className="cs-mm-item"
                onClick={() => { handleNew(); setMobileMenuOpen(false) }}
              >
                <NewIcon size={18} />
                <span>{t('appbar.new')}</span>
              </button>
              <button
                type="button"
                className="cs-mm-item"
                onClick={() => { void openFile(); setMobileMenuOpen(false) }}
              >
                <OpenIcon size={18} />
                <span>{t('appbar.open')}</span>
              </button>
              <button
                type="button"
                className="cs-mm-item"
                onClick={() => { void handleImportDocx(); setMobileMenuOpen(false) }}
              >
                <ImportDocxIcon size={18} />
                <span>{t('appbar.importDocx')}</span>
              </button>
              <button
                type="button"
                className="cs-mm-item cs-mm-primary"
                onClick={() => { void saveFile(); setMobileMenuOpen(false) }}
              >
                <SaveIcon size={18} />
                <span>{t('appbar.save')}</span>
              </button>
              <button
                type="button"
                className="cs-mm-item"
                onClick={() => { void saveFileAs(); setMobileMenuOpen(false) }}
              >
                <SaveAsIcon size={18} />
                <span>{t('appbar.saveAs')}</span>
              </button>
              <button
                type="button"
                className="cs-mm-item"
                onClick={() => { setExportVisible(true); setMobileMenuOpen(false) }}
              >
                <ExportIcon size={18} />
                <span>{t('appbar.export')}</span>
              </button>
            </div>

            <div className="cs-mm-section">
              <div className="cs-mm-section-title">Preferences</div>
              <button
                type="button"
                className="cs-mm-item"
                onClick={() => { setStyleVisible(true); setMobileMenuOpen(false) }}
              >
                <StyleIcon size={18} />
                <span>{t('appbar.style')}</span>
              </button>
              <button
                type="button"
                className="cs-mm-item"
                onClick={() => { setSettingsVisible(true); setMobileMenuOpen(false) }}
              >
                <SettingsIcon size={18} />
                <span>{t('settings.title')}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  )
}
