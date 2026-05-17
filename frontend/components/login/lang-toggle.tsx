'use client'

import { useLang } from '@/lib/i18n/language-context'

export function LangToggle() {
  const { lang, setLang, t } = useLang()
  return (
    <button
      onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
      className="font-mono text-[10px] tracking-[0.2em] uppercase text-text-muted hover:text-foreground transition-colors border border-border px-2 py-1 rounded-sm"
      aria-label="Toggle language"
    >
      {t('langToggle')}
    </button>
  )
}
