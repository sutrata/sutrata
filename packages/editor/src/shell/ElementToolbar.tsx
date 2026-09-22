import React, { useEffect, useState } from 'react'
import { ToolbarButton } from './ToolbarButton'
import { makeSetBlock, makeToggleMark, undo, redo } from './toolbar-actions'
import { runCommand, activeBlockType, subscribe } from '../editor/editor-bus'
import { useTranslation } from '../i18n/useTranslation'
import {
  UndoIcon, RedoIcon, SceneIcon, ActionIcon, CharacterIcon, DialogueIcon, ParentheticalIcon,
  TransitionIcon, CenteredIcon, NoteIcon, PageBreakIcon, SectionIcon, BoldIcon, ItalicIcon, UnderlineIcon, OverflowIcon,
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
  { type: 'note',          label: 'Note',          sigil: '[[ ]]',      shortcut: 'Alt+Shift+N', Icon: NoteIcon, translationKey: 'toolbar.note' },
  { type: 'page_break',    label: 'Page Break',    sigil: '===',        shortcut: '',            Icon: PageBreakIcon, translationKey: 'toolbar.pageBreak' },
  { type: 'section',       label: 'Section',       sigil: '#',          shortcut: '',            Icon: SectionIcon, translationKey: 'toolbar.section' },
]

export function ElementToolbar() {
  const [activeType, setActiveType] = useState<string | null>(null)
  const { t } = useTranslation()

  useEffect(() => subscribe(() => setActiveType(activeBlockType())), [])

  return (
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
          onClick={() => runCommand(makeSetBlock(el.type))}
        >
          <el.Icon size={20} />
        </ToolbarButton>
      ))}
      <span className="cs-tb-sep" />
      <ToolbarButton label={t('toolbar.bold')} shortcut="Mod-B" onClick={() => runCommand(makeToggleMark('bold'))}><BoldIcon size={20} /></ToolbarButton>
      <ToolbarButton label={t('toolbar.italic')} shortcut="Mod-I" onClick={() => runCommand(makeToggleMark('italic'))}><ItalicIcon size={20} /></ToolbarButton>
      <ToolbarButton label={t('toolbar.underline')} shortcut="Mod-U" onClick={() => runCommand(makeToggleMark('underline'))}><UnderlineIcon size={20} /></ToolbarButton>
      <button type="button" className="cs-tb-overflow" aria-label="More" onClick={() => { /* mobile overflow popover */ }}><OverflowIcon size={18} /></button>
    </div>
  )
}
