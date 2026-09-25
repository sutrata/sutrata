import React from 'react'

type IconProps = { size?: number }
const base = (size = 16) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.35,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const NavigatorIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1.5" y="2" width="13" height="12" rx="1.5" />
    <line x1="5.5" y1="2" x2="5.5" y2="14" />
  </svg>
)

export const TitlePageIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 1.5h6l4 4V13.5a1 1 0 01-1 1H3a1 1 0 01-1-1v-11a1 1 0 011-1z" />
    <polyline points="9 1.5 9 5.5 13 5.5" />
    <line x1="5" y1="8" x2="11" y2="8" />
    <line x1="5" y1="10.5" x2="9" y2="10.5" />
  </svg>
)

export const NewIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 1.5h6l4 4V13.5a1 1 0 01-1 1H3a1 1 0 01-1-1v-11a1 1 0 011-1z" />
    <polyline points="9 1.5 9 5.5 13 5.5" />
    <line x1="8" y1="8.5" x2="8" y2="12" />
    <line x1="6.25" y1="10.25" x2="9.75" y2="10.25" />
  </svg>
)

export const OpenIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M1.5 3.5a1 1 0 011-1h3.5l1.5 1.5h7a1 1 0 011 1V6H1.5V3.5z" />
    <path d="M1 6.5h14l-1.5 6.5a1 1 0 01-1 .7H3.5a1 1 0 01-1-.7L1 6.5z" />
  </svg>
)

export const ImportDocxIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 1.5h6l4 4V13.5a1 1 0 01-1 1H3a1 1 0 01-1-1v-11a1 1 0 011-1z" />
    <polyline points="9 1.5 9 5.5 13 5.5" />
    <line x1="8" y1="7.5" x2="8" y2="11.5" />
    <polyline points="6 9.5 8 11.5 10 9.5" />
  </svg>
)

export const StyleIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 2a6 6 0 00-6 6c0 3.3 2.7 6 6 6 1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.4-.5-.9-.5-1.5 0-1.1.9-2 2-2h1.2C13.8 7.5 14 6.7 14 5.8 14 3.7 11.3 2 8 2z" />
    <circle cx="5" cy="6" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="8" cy="4.8" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="11" cy="6" r="0.75" fill="currentColor" stroke="none" />
  </svg>
)

export const SaveIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2.5 2h8.5l2.5 2.5V13.5a1 1 0 01-1 1h-10a1 1 0 01-1-1V3a1 1 0 011-1z" />
    <path d="M5 2v4h5V2" />
    <path d="M4.5 9h7v5h-7z" />
  </svg>
)

export const SaveAsIcon = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2.5 2h7.5l2.5 2.5V8" />
    <path d="M5 2v3.5h4V2" />
    <path d="M2.5 13.5a1 1 0 01-1-1V3a1 1 0 011-1" />
    <path d="M1.5 12.5a1 1 0 001 1h5.5" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="10.5" x2="12" y2="13.5" />
    <line x1="10.5" y1="12" x2="13.5" y2="12" />
  </svg>
)

export const UndoIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2 7c0-2.8 2.2-5 5-5 2.5 0 4.6 1.8 5 4.2" />
    <path d="M2 3v4h4" />
  </svg>
)

export const RedoIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M14 7c0-2.8-2.2-5-5-5C6.5 2 4.4 3.8 4 6.2" />
    <path d="M14 3v4h-4" />
  </svg>
)

export const SceneIcon = ({ size }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 18 18">
    <line x1="3" y1="5" x2="3" y2="13" />
    <line x1="3" y1="9" x2="8" y2="9" />
    <line x1="8" y1="5" x2="8" y2="13" />
    <line x1="12" y1="5" x2="12" y2="13" />
    <line x1="12" y1="9" x2="17" y2="9" />
    <line x1="17" y1="5" x2="17" y2="13" />
  </svg>
)

export const ActionIcon = ({ size }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 18 18">
    <line x1="2" y1="5" x2="16" y2="5" />
    <line x1="2" y1="8" x2="16" y2="8" />
    <line x1="2" y1="11" x2="12" y2="11" />
    <line x1="2" y1="14" x2="9" y2="14" />
  </svg>
)

export const CharacterIcon = ({ size }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 18 18">
    <circle cx="9" cy="6" r="3" />
    <path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" />
  </svg>
)

export const DialogueIcon = ({ size }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 18 18">
    <path d="M2 4h14a1 1 0 011 1v6a1 1 0 01-1 1H6l-4 3v-3H2a1 1 0 01-1-1V5a1 1 0 011-1z" />
  </svg>
)

export const ParentheticalIcon = ({ size }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 18 18">
    <path d="M6 4c-2 2-2 8 0 10" />
    <path d="M12 4c2 2 2 8 0 10" />
  </svg>
)

export const TransitionIcon = ({ size }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 18 18">
    <polyline points="3,6 8,9 3,12" />
    <polyline points="9,6 14,9 9,12" />
    <line x1="15" y1="6" x2="15" y2="12" />
  </svg>
)

export const CenteredIcon = ({ size }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 18 18">
    <line x1="3" y1="5" x2="15" y2="5" />
    <line x1="5" y1="9" x2="13" y2="9" />
    <line x1="3" y1="13" x2="15" y2="13" />
  </svg>
)

export const LyricsIcon = ({ size }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 18 18">
    <circle cx="5" cy="13" r="2" />
    <circle cx="13" cy="11" r="2" />
    <line x1="7" y1="13" x2="7" y2="4" />
    <line x1="15" y1="11" x2="15" y2="2" />
    <line x1="7" y1="4" x2="15" y2="2" />
  </svg>
)

export const NoteIcon = ({ size }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 18 18">
    <rect x="2" y="3" width="11" height="12" rx="1" />
    <line x1="5" y1="7" x2="10" y2="7" />
    <line x1="5" y1="10" x2="10" y2="10" />
    <line x1="5" y1="13" x2="8" y2="13" />
  </svg>
)

export const PageBreakIcon = ({ size }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 18 18">
    <line x1="2" y1="9" x2="16" y2="9" />
    <line x1="2" y1="5" x2="16" y2="5" strokeDasharray="2 2" opacity="0.4" />
    <line x1="2" y1="13" x2="16" y2="13" strokeDasharray="2 2" opacity="0.4" />
  </svg>
)

export const SectionIcon = ({ size }: IconProps) => (
  <svg {...base(size)} viewBox="0 0 18 18">
    <line x1="3" y1="6" x2="15" y2="6" />
    <line x1="3" y1="9" x2="15" y2="9" />
    <line x1="6" y1="3" x2="6" y2="7" />
    <line x1="12" y1="3" x2="12" y2="7" />
    <line x1="6" y1="8" x2="6" y2="12" />
    <line x1="12" y1="8" x2="12" y2="12" />
  </svg>
)

export const BoldIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <text x="3" y="13" fontFamily="Georgia,serif" fontSize="13" fontWeight="700">B</text>
  </svg>
)

export const ItalicIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <text x="5" y="13" fontFamily="Georgia,serif" fontSize="13" fontStyle="italic">I</text>
  </svg>
)

export const UnderlineIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
    <text x="4" y="11" fontFamily="Georgia,serif" fontSize="11" fill="currentColor" stroke="none">U</text>
    <line x1="3" y1="14" x2="13" y2="14" />
  </svg>
)

export const SourceIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <polyline points="5,4 2,8 5,12" />
    <polyline points="11,4 14,8 11,12" />
    <line x1="9" y1="2" x2="7" y2="14" />
  </svg>
)

export const FormattedIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <line x1="2" y1="4" x2="14" y2="4" />
    <line x1="2" y1="7" x2="14" y2="7" />
    <line x1="2" y1="10" x2="9" y2="10" />
  </svg>
)

export const RibbonIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <rect x="1" y="4" width="4" height="4" rx="0.5" />
    <rect x="6" y="4" width="4" height="4" rx="0.5" />
    <rect x="11" y="4" width="4" height="4" rx="0.5" />
    <line x1="1" y1="11" x2="15" y2="11" />
    <line x1="1" y1="13.5" x2="10" y2="13.5" />
  </svg>
)

export const ExportIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2.5 7.5v5a1 1 0 001 1h9a1 1 0 001-1v-5" />
    <line x1="8" y1="2" x2="8" y2="9.5" />
    <polyline points="4.75 5.25 8 2 11.25 5.25" />
  </svg>
)

export const SettingsIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="8" cy="8" r="2.25" />
    <path d="M6.9 1.8h2.2l.3 1.4a4.8 4.8 0 011.2.7l1.3-.6 1.5 1.5-.6 1.3c.3.4.5.8.7 1.2l1.4.3v2.2l-1.4.3a4.8 4.8 0 01-.7 1.2l.6 1.3-1.5 1.5-1.3-.6a4.8 4.8 0 01-1.2.7l-.3 1.4H6.9l-.3-1.4a4.8 4.8 0 01-1.2-.7l-1.3.6-1.5-1.5.6-1.3a4.8 4.8 0 01-.7-1.2l-1.4-.3V6.9l1.4-.3a4.8 4.8 0 01.7-1.2l-.6-1.3 1.5-1.5 1.3.6a4.8 4.8 0 011.2-.7l.3-1.4z" />
  </svg>
)

export const OverflowIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <circle cx="3" cy="8" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="13" cy="8" r="1.5" />
  </svg>
)

export const EyeIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M1 8s3-6 7-6 7 6 7 6-3 6-7 6-7-6-7-6z" />
    <circle cx="8" cy="8" r="2.2" />
  </svg>
)

export const EyeOffIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M1 8s3-6 7-6 7 6 7 6-3 6-7 6-7-6-7-6z" />
    <circle cx="8" cy="8" r="2.2" />
    <line x1="2" y1="2" x2="14" y2="14" />
  </svg>
)

export const LockIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d="M4.5 7V4.5a3.5 3.5 0 017 0V7" />
  </svg>
)

/** Numbered list: "Renumber scenes". */
export const RenumberIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2.5 3.5h1v3M2.5 6.5h2" />
    <path d="M2.5 10h2l-2 2.5h2" />
    <path d="M7 4.5h6.5M7 11.5h6.5" />
  </svg>
)

/** Circle with a slash: "Omit scene". */
export const OmitIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M4.2 11.8l7.6-7.6" />
  </svg>
)

/** Curved arrow back: "Restore scene". */
export const RestoreIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3.5 6.5h6a3.5 3.5 0 010 7H6" />
    <path d="M6 3.5l-2.5 3 2.5 3" />
  </svg>
)

export const StatsIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <line x1="12" y1="14" x2="12" y2="4" />
    <line x1="8" y1="14" x2="8" y2="7" />
    <line x1="4" y1="14" x2="4" y2="10" />
  </svg>
)

export const HistoryIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="8" cy="8.5" r="6" />
    <polyline points="8,5.5 8,8.5 10.5,10" />
  </svg>
)

export const MicIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <rect x="5.5" y="2" width="5" height="8" rx="2.5" />
    <path d="M3 7.5a5 5 0 0010 0" />
    <line x1="8" y1="12.5" x2="8" y2="14.5" />
    <line x1="5.5" y1="14.5" x2="10.5" y2="14.5" />
  </svg>
)

export const SparklesIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 2l1.2 3.8L13 7l-3.8 1.2L8 12l-1.2-3.8L3 7l3.8-1.2L8 2z" />
    <path d="M12.5 11l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9z" />
  </svg>
)

export const ClockIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="8" cy="8" r="6" />
    <polyline points="8 4.5 8 8 10.5 9.5" />
  </svg>
)

export const MenuIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <line x1="2.5" y1="4.5" x2="13.5" y2="4.5" />
    <line x1="2.5" y1="8" x2="13.5" y2="8" />
    <line x1="2.5" y1="11.5" x2="13.5" y2="11.5" />
  </svg>
)

export const CloseIcon = ({ size }: IconProps) => (
  <svg {...base(size)}>
    <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
    <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
  </svg>
)

