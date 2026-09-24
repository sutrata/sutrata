import React from 'react'
import type { CommandContribution } from '../extensions/command-registry'
import { makeSetBlock, makeSetOrToggleNote, makeToggleMark, undo, redo } from './toolbar-actions'
import { runCommand, activeBlockType } from '../editor/editor-bus'
import {
  UndoIcon, RedoIcon, SceneIcon, ActionIcon, CharacterIcon, DialogueIcon, ParentheticalIcon,
  TransitionIcon, CenteredIcon, LyricsIcon, NoteIcon, PageBreakIcon, SectionIcon, BoldIcon, ItalicIcon, UnderlineIcon,
} from './icons'

type Translate = (key: string) => string

interface ElementDef {
  type: string
  sigil: string
  shortcut?: string
  Icon: React.FC<{ size?: number }>
  labelKey: string
}

const ELEMENTS: ElementDef[] = [
  { type: 'scene_heading', sigil: '##',        shortcut: 'Alt-Shift-H', Icon: SceneIcon, labelKey: 'toolbar.scene' },
  { type: 'action',        sigil: '(plain)',   shortcut: 'Alt-Shift-A', Icon: ActionIcon, labelKey: 'toolbar.action' },
  { type: 'character',     sigil: '@',         shortcut: 'Alt-Shift-C', Icon: CharacterIcon, labelKey: 'toolbar.character' },
  { type: 'dialogue',      sigil: '(after @)', shortcut: 'Alt-Shift-D', Icon: DialogueIcon, labelKey: 'toolbar.dialogue' },
  { type: 'parenthetical', sigil: '( )',       shortcut: 'Alt-Shift-P', Icon: ParentheticalIcon, labelKey: 'toolbar.parenthetical' },
  { type: 'transition',    sigil: '>>',        shortcut: 'Alt-Shift-X', Icon: TransitionIcon, labelKey: 'toolbar.transition' },
  { type: 'centered',      sigil: '>> <<',                              Icon: CenteredIcon, labelKey: 'toolbar.centered' },
  { type: 'lyrics',        sigil: '~',         shortcut: 'Alt-Shift-L', Icon: LyricsIcon, labelKey: 'toolbar.lyrics' },
  { type: 'note',          sigil: '[[ ]]',     shortcut: 'Alt-Shift-N', Icon: NoteIcon, labelKey: 'toolbar.note' },
  { type: 'page_break',    sigil: '===',                                Icon: PageBreakIcon, labelKey: 'toolbar.pageBreak' },
  { type: 'section',       sigil: '#',                                  Icon: SectionIcon, labelKey: 'toolbar.section' },
]

/**
 * The editor's own commands, registered like an embedder's: undo/redo,
 * element types (with their Alt+Shift shortcuts) and inline marks, all shown
 * in the element toolbar. Mark and history keys are bound by the ProseMirror
 * keymap, so they only carry a `shortcutHint`.
 */
export function builtinCommands(t: Translate): CommandContribution[] {
  return [
    { id: 'history.undo', label: t('toolbar.undo'), group: 'history', menu: 'toolbar', shortcutHint: 'Mod-Z', icon: s => <UndoIcon size={s} />, run: () => runCommand(undo) },
    { id: 'history.redo', label: t('toolbar.redo'), group: 'history', menu: 'toolbar', shortcutHint: 'Mod-Shift-Z', icon: s => <RedoIcon size={s} />, run: () => runCommand(redo) },
    ...ELEMENTS.map((el): CommandContribution => ({
      id: `element.${el.type}`,
      label: t(el.labelKey),
      group: 'elements',
      menu: 'toolbar',
      sigil: el.sigil,
      shortcut: el.shortcut,
      icon: s => <el.Icon size={s} />,
      isActive: () => activeBlockType() === el.type,
      run: () => runCommand(el.type === 'note' ? makeSetOrToggleNote() : makeSetBlock(el.type)),
    })),
    { id: 'mark.bold', label: t('toolbar.bold'), group: 'marks', menu: 'toolbar', shortcutHint: 'Mod-B', icon: s => <BoldIcon size={s} />, run: () => runCommand(makeToggleMark('bold')) },
    { id: 'mark.italic', label: t('toolbar.italic'), group: 'marks', menu: 'toolbar', shortcutHint: 'Mod-I', icon: s => <ItalicIcon size={s} />, run: () => runCommand(makeToggleMark('italic')) },
    { id: 'mark.underline', label: t('toolbar.underline'), group: 'marks', menu: 'toolbar', shortcutHint: 'Mod-U', icon: s => <UnderlineIcon size={s} />, run: () => runCommand(makeToggleMark('underline')) },
  ]
}
