import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LanguageProvider, TranslationProvider } from '@sutrata/editor'
import '@sutrata/editor/dist/shell/fonts/fonts.css'
import '@sutrata/editor/dist/styles/screenplay.css'

const root = document.getElementById('root')!
createRoot(root).render(
  <React.StrictMode>
    <TranslationProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </TranslationProvider>
  </React.StrictMode>,
)
