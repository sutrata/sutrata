import React from 'react'

/** Same glyph as the editor's AI actions, so the app's AI dialogs match them. */
export function SparklesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M8 2l1.2 3.8L13 7l-3.8 1.2L8 12l-1.2-3.8L3 7l3.8-1.2L8 2z" />
      <path d="M12.5 11l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9z" />
    </svg>
  )
}
