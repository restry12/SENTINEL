'use client'

import * as React from 'react'
import { LoginForm } from './login-form'
import { RegisterForm } from './register-form'
import { useLang } from '@/lib/i18n/language-context'
import styles from '@/app/login/login.module.css'
import { cn } from '@/lib/utils'

export function AuthCard() {
  const [activeTab, setActiveTab] = React.useState<'login' | 'register'>('login')
  const { t } = useLang()

  return (
    <div className={`${styles.authCard} w-full`}>
      <span className={styles.cardCornerBottomLeft} />
      <span className={styles.cardCornerBottomRight} />

      <div className={styles.tabGroup}>
        <div
          className={styles.tabIndicator}
          style={{ transform: activeTab === 'login' ? 'translateX(0)' : 'translateX(100%)' }}
        />
        <button
          className={cn(styles.tabButton, activeTab === 'login' && styles.tabButtonActive)}
          onClick={() => setActiveTab('login')}
        >
          {t('tabLogin')}
        </button>
        <button
          className={cn(styles.tabButton, activeTab === 'register' && styles.tabButtonActive)}
          onClick={() => setActiveTab('register')}
        >
          {t('tabRegister')}
        </button>
      </div>

      <div className="relative overflow-hidden min-h-[400px]">
        {activeTab === 'login' ? (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <LoginForm />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <RegisterForm />
          </div>
        )}
      </div>

      <div className={styles.formFooter}>
        {activeTab === 'login' ? (
          <p>
            {t('footerNoAccount')}{' '}
            <button onClick={() => setActiveTab('register')} className={styles.formLink}>
              {t('footerRequestAccess')}
            </button>
          </p>
        ) : (
          <p>
            {t('footerHasAccount')}{' '}
            <button onClick={() => setActiveTab('login')} className={styles.formLink}>
              {t('footerSignIn')}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
