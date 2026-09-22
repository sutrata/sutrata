import React, { useEffect } from 'react'

export interface ToastItem {
  id: string
  message: string
  type?: 'info' | 'success' | 'warn' | 'error'
}

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="cs-toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastMessage({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, 3500)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const typeClass =
    toast.type === 'success'
      ? 'cs-toast-success'
      : toast.type === 'error'
      ? 'cs-toast-error'
      : toast.type === 'warn'
      ? 'cs-toast-warn'
      : 'cs-toast-info'

  return (
    <div className={`cs-toast ${typeClass}`} role="status">
      <span>{toast.message}</span>
    </div>
  )
}
