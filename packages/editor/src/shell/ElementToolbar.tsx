import React, { useEffect, useState } from 'react'
import { ToolbarButton } from './ToolbarButton'
import { makeSetBlock, makeSetOrToggleNote, makeToggleMark, undo, redo } from './toolbar-actions'
import { runCommand, activeBlockType, subscribe } from '../editor/editor-bus'
import { useTranslation } from '../i18n/useTranslation'
import {
  UndoIcon, RedoIcon, SceneIcon, ActionIcon, CharacterIcon, DialogueIcon, ParentheticalIcon,
  TransitionIcon, CenteredIcon, LyricsIcon, NoteIcon, PageBreakIcon, SectionIcon, BoldIcon, ItalicIcon, UnderlineIcon, OverflowIcon,
  CloseIcon,
} from './icons'

interface ElementDef {
  type: string
  label: string
  sigil: string
  shortcut: string
  Icon: React.FC<{ size?: number }>
  translationKey: string
}

const ELEMENTS: ElementDef[] = [
  { type: 'scene_heading', label: 'Scene Heading', sigil: '##',         shortcut: 'Alt+Shift+H', Icon: SceneIcon, translationKey: 'toolbar.scene' },
  { type: 'action',        label: 'Action',        sigil: '(plain)',    shortcut: 'Alt+Shift+A', Icon: ActionIcon, translationKey: 'toolbar.action' },
  { type: 'character',     label: 'Character',     sigil: '@',          shortcut: 'Alt+Shift+C', Icon: CharacterIcon, translationKey: 'toolbar.character' },
  { type: 'dialogue',      label: 'Dialogue',      sigil: '(after @)',  shortcut: 'Alt+Shift+D', Icon: DialogueIcon, translationKey: 'toolbar.dialogue' },
  { type: 'parenthetical', label: 'Parenthetical', sigil: '( )',        shortcut: 'Alt+Shift+P', Icon: ParentheticalIcon, translationKey: 'toolbar.parenthetical' },
  { type: 'transition',    label: 'Transition',    sigil: '>>',         shortcut: 'Alt+Shift+X', Icon: TransitionIcon, translationKey: 'toolbar.transition' },
  { type: 'centered',      label: 'Centered',      sigil: '>> <<',      shortcut: '',            Icon: CenteredIcon, translationKey: 'toolbar.centered' },
  { type: 'lyrics',        label: 'Lyrics',        sigil: '~',          shortcut: 'Alt+Shift+L', Icon: LyricsIcon, translationKey: 'toolbar.lyrics' },
  { type: 'note',          label: 'Note',          sigil: '[[ ]]',      shortcut: 'Alt+Shift+N', Icon: NoteIcon, translationKey: 'toolbar.note' },
  { type: 'page_break',    label: 'Page Break',    sigil: '===',        shortcut: '',            Icon: PageBreakIcon, translationKey: 'toolbar.pageBreak' },
  { type: 'section',       label: 'Section',       sigil: '#',          shortcut: '',            Icon: SectionIcon, translationKey: 'toolbar.section' },
]

export function ElementToolbar() {
  const [activeType, setActiveType] = useState<string | null>(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const { t } = useTranslation()

  useEffect(() => subscribe(() => setActiveType(activeBlockType())), [])

  return (
    <>
      <div className="cs-element-toolbar" role="toolbar" aria-label="Editing toolbar">
        <ToolbarButton label={t('toolbar.undo')} shortcut="Mod-Z" onClick={() => runCommand(undo)}><UndoIcon size={20} /></ToolbarButton>
        <ToolbarButton label={t('toolbar.redo')} shortcut="Mod-Shift-Z" onClick={() => runCommand(redo)}><RedoIcon size={20} /></ToolbarButton>
        <span className="cs-tb-sep" />
        {ELEMENTS.map(el => (
          <ToolbarButton
            key={el.type}
            label={t(el.translationKey)}
            sigil={el.sigil}
            shortcut={el.shortcut || undefined}
            active={activeType === el.type}
            onClick={() => runCommand(el.type === 'note' ? makeSetOrToggleNote() : makeSetBlock(el.type))}
          >
            <el.Icon size={20} />
          </ToolbarButton>
        ))}
        <span className="cs-tb-sep" />
        <ToolbarButton label={t('toolbar.bold')} shortcut="Mod-B" onClick={() => runCommand(makeToggleMark('bold'))}><BoldIcon size={20} /></ToolbarButton>
        <ToolbarButton label={t('toolbar.italic')} shortcut="Mod-I" onClick={() => runCommand(makeToggleMark('italic'))}><ItalicIcon size={20} /></ToolbarButton>
        <ToolbarButton label={t('toolbar.underline')} shortcut="Mod-U" onClick={() => runCommand(makeToggleMark('underline'))}><UnderlineIcon size={20} /></ToolbarButton>
        <button
          type="button"
          className={`cs-tb-overflow${overflowOpen ? ' cs-tb-overflow-active' : ''}`}
          aria-label="More"
          aria-expanded={overflowOpen}
          onClick={() => setOverflowOpen(!overflowOpen)}
        >
          <OverflowIcon size={18} />
        </button>
      </div>

      {/* Mobile Overflow Bottom Sheet */}
      {overflowOpen && (
        <>
          <div
            className="cs-tb-overflow-backdrop"
            aria-hidden="true"
            onClick={() => setOverflowOpen(false)}
          />
          <div
            className="cs-tb-overflow-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Screenplay Elements & Formatting"
          >
            <div className="cs-tb-overflow-header">
              <span className="cs-tb-overflow-title">Formatting &amp; Elements</span>
              <button
                type="button"
                className="cs-tb-overflow-close"
                aria-label="Close"
                onClick={() => setOverflowOpen(false)}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="cs-tb-overflow-section-label">Inline Formatting</div>
            <div className="cs-tb-overflow-inline-grid">
              <button
                type="button"
                className="cs-tb-overflow-item"
                onClick={() => { runCommand(makeToggleMark('bold')); setOverflowOpen(false) }}
              >
                <BoldIcon size={18} />
                <span>{t('toolbar.bold')}</span>
              </button>
              <button
                type="button"
                className="cs-tb-overflow-item"
                onClick={() => { runCommand(makeToggleMark('italic')); setOverflowOpen(false) }}
              >
                <ItalicIcon size={18} />
                <span>{t('toolbar.italic')}</span>
              </button>
              <button
                type="button"
                className="cs-tb-overflow-item"
                onClick={() => { runCommand(makeToggleMark('underline')); setOverflowOpen(false) }}
              >
                <UnderlineIcon size={18} />
                <span>{t('toolbar.underline')}</span>
              </button>
              <button
                type="button"
                className="cs-tb-overflow-item"
                onClick={() => { runCommand(undo); setOverflowOpen(false) }}
              >
                <UndoIcon size={18} />
                <span>{t('toolbar.undo')}</span>
              </button>
              <button
                type="button"
                className="cs-tb-overflow-item"
                onClick={() => { runCommand(redo); setOverflowOpen(false) }}
              >
                <RedoIcon size={18} />
                <span>{t('toolbar.redo')}</span>
              </button>
            </div>

            <div className="cs-tb-overflow-section-label">Screenplay Elements</div>
            <div className="cs-tb-overflow-list">
              {ELEMENTS.map(el => (
                <button
                  key={el.type}
                  type="button"
                  className={`cs-tb-overflow-list-item${activeType === el.type ? ' cs-tb-overflow-item-active' : ''}`}
                  onClick={() => {
                    runCommand(el.type === 'note' ? makeSetOrToggleNote() : makeSetBlock(el.type))
                    setOverflowOpen(false)
                  }}
                >
                  <div className="cs-tb-overflow-list-icon">
                    <el.Icon size={18} />
                  </div>
                  <div className="cs-tb-overflow-list-text">
                    <span className="cs-tb-overflow-list-name">{t(el.translationKey)}</span>
                    <span className="cs-tb-overflow-list-sigil">{el.sigil}</span>
                  </div>
                  {activeType === el.type && (
                    <span className="cs-tb-overflow-current-badge">Active</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
