export interface SpellMenu {
  x: number
  y: number
  word: string
  suggestions: string[]
  canEdit: boolean
  onReplace: (replacement: string) => void
  onIgnore: () => void
}

let open: HTMLElement | null = null

function close() {
  open?.remove()
  open = null
  document.removeEventListener('mousedown', onOutside, true)
  document.removeEventListener('keydown', onKey, true)
}
function onOutside(e: MouseEvent) { if (open && !open.contains(e.target as Node)) close() }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }

/** The right-click menu on a misspelled word: replacements, then "Ignore". */
export function showSpellMenu({ x, y, word, suggestions, canEdit, onReplace, onIgnore }: SpellMenu) {
  close()
  const menu = document.createElement('div')
  menu.className = 'cs-spell-menu'
  menu.setAttribute('role', 'menu')

  const add = (label: string, onPick: (() => void) | null, className = '') => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = `cs-spell-menu-item ${className}`.trim()
    item.setAttribute('role', 'menuitem')
    item.textContent = label
    if (onPick) {
      item.addEventListener('mousedown', e => { e.preventDefault(); close(); onPick() })
    } else {
      item.disabled = true
    }
    menu.appendChild(item)
  }

  if (canEdit) {
    if (suggestions.length === 0) add('No suggestions', null)
    for (const s of suggestions) add(s, () => onReplace(s), 'cs-spell-menu-suggestion')
    const rule = document.createElement('div')
    rule.className = 'cs-spell-menu-rule'
    menu.appendChild(rule)
  }
  add(`Ignore “${word}”`, onIgnore)

  menu.style.left = `${x}px`
  menu.style.top = `${y}px`
  document.body.appendChild(menu)
  // Keep it on screen.
  const r = menu.getBoundingClientRect()
  if (r.right > window.innerWidth) menu.style.left = `${Math.max(0, window.innerWidth - r.width - 4)}px`
  if (r.bottom > window.innerHeight) menu.style.top = `${Math.max(0, window.innerHeight - r.height - 4)}px`
  open = menu
  document.addEventListener('mousedown', onOutside, true)
  document.addEventListener('keydown', onKey, true)
  menu.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
}
