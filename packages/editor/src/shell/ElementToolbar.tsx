import React, { useEffect, useState } from 'react'
import { ToolbarButton } from './ToolbarButton'
import { subscribe } from '../editor/editor-bus'
import { OverflowIcon, CloseIcon } from './icons'
import { useCommands, useCommandContext, displayShortcut } from './use-commands'
import type { CommandContribution } from '../extensions/command-registry'

/** Toolbar groups in display order; embedder groups follow. */
const GROUP_ORDER = ['history', 'elements', 'marks']

function groupsOf(commands: CommandContribution[]): CommandContribution[][] {
  const groups = new Map<string, CommandContribution[]>()
  for (const c of commands) {
    const g = c.group ?? 'extensions'
    groups.set(g, [...(groups.get(g) ?? []), c])
  }
  const names = [...GROUP_ORDER.filter(g => groups.has(g)), ...[...groups.keys()].filter(g => !GROUP_ORDER.includes(g))]
  return names.map(g => groups.get(g)!)
}

/**
 * Renders every command registered with `menu: 'toolbar'` — the editor's
 * built-ins (shell/builtin-commands.tsx) and the embedder's — grouped, with a
 * separator between groups.
 */
export function ElementToolbar() {
  const [, setTick] = useState(0)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const commands = useCommands().filter(c => c.menu === 'toolbar')
  const context = useCommandContext()

  // Re-render on selection changes so isActive() stays current.
  useEffect(() => subscribe(() => setTick(n => n + 1)), [])

  const ctx = context()
  const groups = groupsOf(commands)
  const inline = commands.filter(c => c.group === 'marks' || c.group === 'history')
  const elements = commands.filter(c => c.group === 'elements')
  const others = commands.filter(c => !['marks', 'history', 'elements'].includes(c.group ?? ''))
  const run = (c: CommandContribution) => { c.run(context()); setOverflowOpen(false) }

  return (
    <>
      <div className="cs-element-toolbar" role="toolbar" aria-label="Editing toolbar">
        {groups.map((group, gi) => (
          <React.Fragment key={group[0]!.group ?? `g${gi}`}>
            {gi > 0 && <span className="cs-tb-sep" />}
            {group.map(c => (
              <ToolbarButton
                key={c.id}
                label={c.label}
                sigil={c.sigil}
                shortcut={displayShortcut(c.shortcut ?? c.shortcutHint)}
                active={c.isActive?.(ctx) ?? false}
                onClick={() => c.run(context())}
              >
                {c.icon ? c.icon(20) : <span className="cs-tb-text-label">{c.label}</span>}
              </ToolbarButton>
            ))}
          </React.Fragment>
        ))}
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
              {inline.map(c => (
                <button key={c.id} type="button" className="cs-tb-overflow-item" onClick={() => run(c)}>
                  {c.icon?.(18)}
                  <span>{c.label}</span>
                </button>
              ))}
            </div>

            <div className="cs-tb-overflow-section-label">Screenplay Elements</div>
            <div className="cs-tb-overflow-list">
              {[...elements, ...others].map(c => {
                const active = c.isActive?.(ctx) ?? false
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`cs-tb-overflow-list-item${active ? ' cs-tb-overflow-item-active' : ''}`}
                    onClick={() => run(c)}
                  >
                    <div className="cs-tb-overflow-list-icon">{c.icon?.(18)}</div>
                    <div className="cs-tb-overflow-list-text">
                      <span className="cs-tb-overflow-list-name">{c.label}</span>
                      {c.sigil && <span className="cs-tb-overflow-list-sigil">{c.sigil}</span>}
                    </div>
                    {active && <span className="cs-tb-overflow-current-badge">Active</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
