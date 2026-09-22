import React from 'react'

interface ToolbarButtonProps {
  label: string
  sigil?: string
  shortcut?: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}

export function ToolbarButton({ label, sigil, shortcut, active, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`cs-tb-btn${active ? ' cs-tb-active' : ''}`}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        {children}
      </div>
      <span className="cs-tb-tip" role="tooltip">
        <span>{label}</span>
        {sigil ? <span className="cs-tb-sigil">{sigil}</span> : null}
        {shortcut ? <span className="cs-tb-key">{shortcut}</span> : null}
      </span>
    </button>
  )
}
