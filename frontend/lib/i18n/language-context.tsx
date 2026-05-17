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

  React.useEffect(() => {
    const stored = localStorage.getItem('sentinel_lang')
    if (stored === 'es' || stored === 'en') setLangState(stored)
  }, [])

  const setLang = React.useCallback((next: Lang) => {
    localStorage.setItem('sentinel_lang', next)
    setLangState(next)
  }, [])

  const t = React.useCallback(
    (key: TranslationKey): string => translations[lang][key],
    [lang]
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
