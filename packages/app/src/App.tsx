import React, { useMemo, useRef, useState } from 'react'
import { DocumentProvider, AppShell, createPanelRegistry } from '@sutrata/editor'
import { localStorageAdapter } from './local-storage-adapter'
import { createByoKeyAIProvider, createWebSpeechProvider } from './ai/byo-key-providers'
import { AISettingsSection } from './ai/AISettingsSection'
import { OnboardingDialog } from './ai/OnboardingDialog'

export function App() {
  const [setupOpen, setSetupOpen] = useState(false)
  const openSetup = useRef(() => setSetupOpen(true)).current

  // Created once: the editor keeps provider/registry identity stable.
  const aiProvider = useMemo(() => createByoKeyAIProvider(openSetup), [openSetup])
  const speechProvider = useMemo(() => createWebSpeechProvider(), [])
  const panels = useMemo(() => createPanelRegistry([
    {
      id: 'byo-key-ai',
      title: 'Intelligence & Voice Settings',
      location: 'settings',
      render: () => <AISettingsSection openSetup={openSetup} />,
    },
  ]), [openSetup])

  return (
    <DocumentProvider
      storageAdapter={localStorageAdapter}
      aiProvider={aiProvider}
      speechProvider={speechProvider}
      panels={panels}
    >
      <AppShell />
      {setupOpen && <OnboardingDialog onClose={() => setSetupOpen(false)} />}
    </DocumentProvider>
  )
}
