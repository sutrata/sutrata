import React from 'react'
import { DocumentProvider, AppShell } from '@sutrata/editor'
import { localStorageAdapter } from './local-storage-adapter'

export function App() {
  return (
    <DocumentProvider storageAdapter={localStorageAdapter}>
      <AppShell />
    </DocumentProvider>
  )
}
