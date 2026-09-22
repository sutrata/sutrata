import React from 'react'
import { useDocument } from '../context/DocumentContext'
import { useTranslation } from '../i18n/useTranslation'
import {
  NavigatorIcon, TitlePageIcon, NewIcon, OpenIcon, SaveIcon, SaveAsIcon,
  SourceIcon, FormattedIcon, RibbonIcon, ExportIcon, SettingsIcon, ImportDocxIcon, StyleIcon,
  MicIcon,
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
    translitMode, setTranslitMode, voiceActive, setVoiceActive, openFile, saveFile, saveFileAs, setText,
    importDocx, styleVisible, setStyleVisible, showConfirm, showToast,
  } = useDocument()
  const { t, locale } = useTranslation()
  const name = filePath ?? 'untitled.sutra'
  const nextMode = mode === 'formatted' ? 'source' : 'formatted'

  const handleNew = () => {
    if (!isDirty) {
      setText(getTemplate(locale))
    } else {
      showConfirm({
        title: 'Discard Unsaved Changes?',
        message: 'Starting a new screenplay will discard all unsaved edits to your current document.',
        confirmLabel: 'Discard & Create New',
        destructive: true,
        onConfirm: () => setText(getTemplate(locale)),
      })
    }
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
      <div className="cs-ab-group">
        <div className="cs-ab-brand" title="Sutrata Multilingual Screenplay Editor">
          <SutrataLogo size={20} showText={false} />
          <span>Sutrata</span>
        </div>
        <span className="cs-ab-sep" />
        <AbBtn
          label={t('appbar.navigator')}
          shortcut="Ctrl+Shift+B"
          active={navVisible}
          onClick={() => setNavVisible(!navVisible)}
        >
          <NavigatorIcon size={18} />
        </AbBtn>
        <AbBtn label={t('appbar.titlePage')} onClick={openTitlePageForm}>
          <TitlePageIcon size={18} />
        </AbBtn>
        <div className="cs-ab-file-pill" title={filePath ?? 'untitled.sutra'}>
          <span>{name}</span>
          {isDirty && <span className="cs-ab-dirty" title="Unsaved edits" />}
        </div>
      </div>

      <span className="cs-ab-spacer" />

      {/* Center zone: View Mode, Ribbon, Transliteration, Metadata */}
      <div className="cs-ab-group">
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

      <span className="cs-ab-spacer" />

      {/* Right zone: File Operations, Save, Export, Settings */}
      <div className="cs-ab-group">
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
    </header>
  )
}
