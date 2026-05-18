'use client'

import * as React from 'react'
import { translations, type Lang, type TranslationKey } from './translations'

type LanguageContextValue = {
  lang: Lang
  t: (key: TranslationKey) => string
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang: Lang = 'es'

  const t = React.useCallback(
    (key: TranslationKey): string => {
      return translations[lang][key]
    },
    [lang]
  )

  return (
    <LanguageContext.Provider value={{ lang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = React.useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider')
  return ctx
}
