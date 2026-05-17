'use client'

import { useLang } from '@/lib/i18n/language-context'

export function HeaderStatus() {
  const { t } = useLang()
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="w-1 h-1 rounded-full bg-orange animate-pulse" />
        <span className="text-text-2">{t('headerNasa')}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-1 h-1 rounded-full bg-blue" />
        <span className="text-text-2">{t('headerSat')}</span>
      </div>
      <div className="text-text-dim">
        {t('headerTime')} <strong className="text-foreground ml-1">12:34:56 UTC</strong>
      </div>
    </>
  )
}
