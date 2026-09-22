import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

// Statically import all locale files
import en from '../locales/en.json'
import hi from '../locales/hi.json'
import ta from '../locales/ta.json'
import te from '../locales/te.json'
import ml from '../locales/ml.json'
import kn from '../locales/kn.json'
import bn from '../locales/bn.json'
import gu from '../locales/gu.json'
import mr from '../locales/mr.json'

const LOCALES: Record<string, Record<string, string>> = { en, hi, ta, te, ml, kn, bn, gu, mr }

interface TranslationContextType {
  locale: string
  setLocale: (locale: string) => void
  t: (key: string) => string
}

const TranslationContext = createContext<TranslationContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
})

const STORAGE_KEY = 'sutrata-ui-locale'

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(STORAGE_KEY) : (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)
      return saved && LOCALES[saved] ? saved : 'en'
    } catch {
      return 'en'
    }
  })

  const setLocale = useCallback((newLocale: string) => {
    if (LOCALES[newLocale]) {
      setLocaleState(newLocale)
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY, newLocale)
        } else if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, newLocale)
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [])

  const t = useCallback((key: string): string => {
    const strings = LOCALES[locale]
    if (strings?.[key] !== undefined) return strings[key]
    // Fallback to English
    return LOCALES['en']?.[key] ?? key
  }, [locale])

  return (
    <TranslationContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </TranslationContext.Provider>
  )
}

export function useTranslation() {
  return useContext(TranslationContext)
}
