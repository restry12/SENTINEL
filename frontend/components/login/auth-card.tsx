'use client'

import * as React from 'react'
import { LoginForm } from './login-form'
import { RegisterForm } from './register-form'
import styles from '@/app/login/login.module.css'
import { cn } from '@/lib/utils'

export function AuthCard() {
  const [activeTab, setActiveTab] = React.useState<'login' | 'register'>('login')

  return (
    <div className={`${styles.authCard} w-full`}>
      {/* Corner decorative elements (handled by CSS in login.module.css) */}
      <span className={styles.cardCornerBottomLeft} />
      <span className={styles.cardCornerBottomRight} />

      <div className={styles.tabGroup}>
        <div
          className={styles.tabIndicator}
          style={{
            transform: activeTab === 'login' ? 'translateX(0)' : 'translateX(100%)',
          }}
        />
        <button
          className={cn(
            styles.tabButton,
            activeTab === 'login' && styles.tabButtonActive
          )}
          onClick={() => setActiveTab('login')}
        >
          Iniciar Sesión
        </button>
        <button
          className={cn(
            styles.tabButton,
            activeTab === 'register' && styles.tabButtonActive
          )}
          onClick={() => setActiveTab('register')}
        >
          Registrarse
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
            ¿No tiene una cuenta?{' '}
            <button
              onClick={() => setActiveTab('register')}
              className={styles.formLink}
            >
              Solicite acceso aquí
            </button>
          </p>
        ) : (
          <p>
            ¿Ya tiene una cuenta?{' '}
            <button
              onClick={() => setActiveTab('login')}
              className={styles.formLink}
            >
              Ingrese aquí
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
