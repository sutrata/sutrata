import React, { useState, useSyncExternalStore } from 'react'
import { useTranslation } from '@sutrata/editor'
import { getUpdateReady, reloadForUpdate, subscribeUpdateReady } from './pwa'

export function UpdatePrompt() {
  const { t } = useTranslation()
  const ready = useSyncExternalStore(subscribeUpdateReady, getUpdateReady)
  const [dismissed, setDismissed] = useState(false)
  if (!ready || dismissed) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8,
        background: 'var(--cs-ui-bg-app-bar)', color: 'var(--cs-ui-text-dark-primary)',
        border: '1px solid var(--cs-ui-border-dark)', boxShadow: '0 4px 16px rgba(0,0,0,0.35)', fontSize: 14,
      }}
    >
      <span>{t('update.available')}</span>
      <button
        type="button"
        onClick={() => { void reloadForUpdate() }}
        style={{ background: 'var(--cs-ui-accent)', color: '#fff', border: 0, borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
      >
        {t('update.reload')}
      </button>
      <button
        type="button"
        aria-label={t('update.dismiss')}
        onClick={() => setDismissed(true)}
        style={{ background: 'transparent', color: 'var(--cs-ui-text-dark-secondary)', border: 0, cursor: 'pointer', fontSize: 16 }}
      >
        ×
      </button>
    </div>
  )
}
