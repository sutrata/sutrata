import React, { useEffect, useRef } from 'react'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel?: () => void
}

interface ConfirmDialogProps {
  options: ConfirmOptions
  onClose: () => void
}

export function ConfirmDialog({ options, onClose }: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        options.onCancel?.()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [options, onClose])

  return (
    <div className="cs-confirm-overlay" role="presentation" onClick={() => { options.onCancel?.(); onClose() }}>
      <div
        className="cs-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cs-confirm-title"
        aria-describedby="cs-confirm-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div id="cs-confirm-title" className="cs-confirm-title">{options.title}</div>
        <div id="cs-confirm-desc" className="cs-confirm-msg">{options.message}</div>
        <div className="cs-confirm-actions">
          <button
            type="button"
            className="cs-confirm-btn-cancel"
            onClick={() => {
              options.onCancel?.()
              onClose()
            }}
          >
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={options.destructive ? 'cs-confirm-btn-danger' : 'cs-confirm-btn-primary'}
            onClick={() => {
              options.onConfirm()
              onClose()
            }}
          >
            {options.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
