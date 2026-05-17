'use client'

import * as React from 'react'
import { translations, type Lang, type TranslationKey } from './translations'

type LanguageContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>('es')
  const [isHydrated, setIsHydrated] = React.useState(false)

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('sentinel_lang')
      if (stored === 'es' || stored === 'en') {
        setLangState(stored)
      }
    } catch {
      // localStorage unavailable
    }
    setIsHydrated(true)
  }, [])

  const setLang = React.useCallback((next: Lang) => {
    try {
      localStorage.setItem('sentinel_lang', next)
    } catch {
      // localStorage unavailable
    }
    setLangState(next)
  }, [])

  const t = React.useCallback(
    (key: TranslationKey): string => {
      // During hydration, we MUST use the same language as the server ('es')
      // to avoid hydration mismatch errors. After hydration, we can use the stored lang.
      const activeLang = isHydrated ? lang : 'es'
      return translations[activeLang][key]
    },
    [lang, isHydrated]
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = React.useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider')
  return ctx
}
