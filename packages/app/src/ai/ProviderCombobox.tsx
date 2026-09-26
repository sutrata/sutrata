import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ProviderConfig } from './ai-client'

interface Props {
  id?: string
  providers: ProviderConfig[]
  /** Listed first, under "Your providers". */
  pinnedIds: Set<string>
  value: string
  onChange: (providerId: string) => void
}

type Row = { kind: 'group'; label: string } | { kind: 'option'; provider: ProviderConfig }

/**
 * Searchable provider picker: a button showing the selection that opens a
 * panel with a search box and the (filtered) list. The panel is portalled to
 * <body> with fixed positioning because the dialogs it sits in clip overflow.
 * Keyboard: arrows move, Enter picks, Escape closes.
 */
export function ProviderCombobox({ id, providers, pinnedIds, value, onChange }: Props) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const needle = query.trim().toLowerCase()
  const matches = (p: ProviderConfig) =>
    !needle || p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle)
  const pinned = providers.filter(p => pinnedIds.has(p.id) && matches(p))
  const rest = providers.filter(p => !pinnedIds.has(p.id) && matches(p))
  const options = [...pinned, ...rest]
  const rows: Row[] = [
    ...(pinned.length ? [{ kind: 'group' as const, label: 'Your providers' }] : []),
    ...pinned.map(provider => ({ kind: 'option' as const, provider })),
    ...(rest.length && pinned.length ? [{ kind: 'group' as const, label: 'All providers' }] : []),
    ...rest.map(provider => ({ kind: 'option' as const, provider })),
  ]
  const selected = providers.find(p => p.id === value)

  const openPanel = () => {
    setQuery('')
    const index = [...providers.filter(p => pinnedIds.has(p.id)), ...providers.filter(p => !pinnedIds.has(p.id))]
      .findIndex(p => p.id === value)
    setActive(Math.max(0, index))
    setRect(triggerRef.current?.getBoundingClientRect() ?? null)
    setOpen(true)
  }

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  const pick = (provider: ProviderConfig | undefined) => {
    if (!provider) return
    onChange(provider.id)
    close(true)
  }

  // Close on outside click, or when the page scrolls/resizes under the panel.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false)
    }
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) close(false)
    }
    const onResize = () => close(false)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(options[active])
    } else if (e.key === 'Escape') {
      // Close the panel only, not the dialog around it.
      e.preventDefault()
      e.stopPropagation()
      close(true)
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  // Panels near the bottom of the viewport open upwards.
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0
  const openUp = !!rect && spaceBelow < 300 && rect.top > spaceBelow
  const panelStyle: React.CSSProperties = rect ? {
    left: rect.left,
    width: rect.width,
    ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
  } : {}

  let optionIndex = -1
  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="cs-ai-combo-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={e => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            openPanel()
          }
        }}
      >
        <span>{selected?.name ?? value}</span>
        <span aria-hidden="true" className="cs-ai-combo-caret">▾</span>
      </button>

      {open && createPortal(
        <div ref={panelRef} className="cs-ai-combo-panel" style={panelStyle}>
          <input
            autoFocus
            className="cs-ai-combo-search"
            role="combobox"
            aria-label="Search providers"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={onSearchKeyDown}
            placeholder={`Search ${providers.length} providers…`}
          />
          <ul ref={listRef} id={listId} role="listbox" aria-label="Providers" className="cs-ai-combo-list">
            {rows.map(row => {
              if (row.kind === 'group') {
                return <li key={`g-${row.label}`} role="presentation" className="cs-ai-combo-group">{row.label}</li>
              }
              const index = ++optionIndex
              const isSelected = row.provider.id === value
              return (
                <li
                  key={row.provider.id}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={`cs-ai-combo-option${index === active ? ' is-active' : ''}`}
                  onMouseMove={() => setActive(index)}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => pick(row.provider)}
                >
                  <span>{row.provider.name}</span>
                  {isSelected && <span aria-hidden="true">✓</span>}
                </li>
              )
            })}
            {options.length === 0 && <li className="cs-ai-combo-empty">No providers match "{query.trim()}"</li>}
          </ul>
        </div>,
        document.body,
      )}
    </>
  )
}
