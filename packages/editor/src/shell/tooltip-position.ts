import type React from 'react'

const EDGE_MARGIN = 8
const LONG_PRESS_MS = 450
const TOUCH_TIP_HIDE_MS = 1400
/** Clear of the fingertip resting on the button. */
const TOUCH_TIP_GAP = 18

/**
 * Tooltips are centred on their button; near the viewport edges that clips
 * them. Measure the tooltip and set `--cs-tip-shift` so it slides back inside
 * the viewport.
 */
function fitTip(btn: HTMLElement, tip: HTMLElement) {
  const center = btn.getBoundingClientRect().left + btn.offsetWidth / 2
  const half = tip.offsetWidth / 2
  const vw = document.documentElement.clientWidth
  let shift = 0
  if (center - half < EDGE_MARGIN) shift = EDGE_MARGIN - (center - half)
  else if (center + half > vw - EDGE_MARGIN) shift = vw - EDGE_MARGIN - (center + half)
  tip.style.setProperty('--cs-tip-shift', `${Math.round(shift)}px`)
}

function onHover(e: React.SyntheticEvent<HTMLElement>) {
  const btn = e.currentTarget
  const tip = btn.querySelector<HTMLElement>('.cs-tb-tip')
  if (tip) fitTip(btn, tip)
}

interface PressState { timer?: number; hide?: number; x: number; y: number; fired: boolean }
const presses = new WeakMap<HTMLElement, PressState>()

function closeTip(btn: HTMLElement) {
  btn.classList.remove('cs-tip-open')
}

function onPointerDown(e: React.PointerEvent<HTMLElement>) {
  if (e.pointerType !== 'touch') return
  const btn = e.currentTarget
  const prev = presses.get(btn)
  if (prev) { window.clearTimeout(prev.timer); window.clearTimeout(prev.hide) }
  const state: PressState = { x: e.clientX, y: e.clientY, fired: false }
  presses.set(btn, state)
  state.timer = window.setTimeout(() => {
    const tip = btn.querySelector<HTMLElement>('.cs-tb-tip')
    if (!tip) return
    state.fired = true
    btn.classList.add('cs-tip-open')
    // The toolbar clips overflow on mobile, so the open tip is `position: fixed`.
    tip.style.setProperty('--cs-tip-top', `${Math.round(btn.getBoundingClientRect().bottom + TOUCH_TIP_GAP)}px`)
    tip.style.setProperty('--cs-tip-left', `${Math.round(btn.getBoundingClientRect().left + btn.offsetWidth / 2)}px`)
    fitTip(btn, tip)
  }, LONG_PRESS_MS)
}

function onPointerMove(e: React.PointerEvent<HTMLElement>) {
  const state = presses.get(e.currentTarget)
  // Scrolling the toolbar is not a long-press.
  if (state && !state.fired && Math.hypot(e.clientX - state.x, e.clientY - state.y) > 10) {
    window.clearTimeout(state.timer)
  }
}

function onPointerEnd(e: React.PointerEvent<HTMLElement>) {
  const btn = e.currentTarget
  const state = presses.get(btn)
  if (!state) return
  window.clearTimeout(state.timer)
  if (state.fired) state.hide = window.setTimeout(() => closeTip(btn), TOUCH_TIP_HIDE_MS)
}

/** A long-press shows the tip instead of activating the button. */
function onClickCapture(e: React.MouseEvent<HTMLElement>) {
  const state = presses.get(e.currentTarget)
  if (state?.fired) {
    state.fired = false
    e.preventDefault()
    e.stopPropagation()
  }
}

/** Props for a toolbar button: edge-aware hover tooltip plus long-press on touch. */
export const tipProps = {
  onMouseEnter: onHover,
  onFocus: onHover,
  onPointerDown,
  onPointerMove,
  onPointerUp: onPointerEnd,
  onPointerCancel: onPointerEnd,
  onClickCapture,
  onContextMenu: (e: React.MouseEvent) => {
    // Android fires a context menu on long-press; the tooltip replaces it.
    if ((e.nativeEvent as PointerEvent).pointerType === 'touch') e.preventDefault()
  },
}
