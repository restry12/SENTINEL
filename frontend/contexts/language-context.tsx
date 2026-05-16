'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'es' | 'en'

export const t = {
  es: {
    // TopBar
    brandSub:        'Inteligencia de Incendios',
    statusCritical:  'Crítico Activo',
    hotspots:        'FOCOS',
    operational:     'OPERACIONAL',
    // Nav
    navDashboard:    'PANEL',
    navAir:          'CALIDAD AIRE',
    // Air page header
    airMonitor:      'MONITOR CALIDAD AIRE',
    // Login
    welcome:         'Bienvenido a SENTINEL',
    loginSub:        'Ingrese sus credenciales para acceder al comando central de monitoreo.',
    emailLabel:      'Email de Operador',
    passwordLabel:   'Clave de Acceso',
    loginBtn:        'Iniciar Sesión',
    orQuick:         'O continúa sin cuenta',
    demoBtn:         'Ver Demo →',
    noAccount:       '¿No tiene una cuenta?',
    requestAccess:   'Solicite acceso aquí',
    hasAccount:      '¿Ya tiene una cuenta?',
    enter:           'Ingrese aquí',
  },
  en: {
    brandSub:        'Wildfire Intelligence',
    statusCritical:  'Critical Active',
    hotspots:        'HOTSPOTS',
    operational:     'OPERATIONAL',
    navDashboard:    'DASHBOARD',
    navAir:          'AIR QUALITY',
    airMonitor:      'AIR QUALITY MONITOR',
    welcome:         'Welcome to SENTINEL',
    loginSub:        'Enter your credentials to access the central monitoring command.',
    emailLabel:      'Operator Email',
    passwordLabel:   'Access Key',
    loginBtn:        'Sign In',
    orQuick:         'Or continue without account',
    demoBtn:         'View Demo →',
    noAccount:       'Don\'t have an account?',
    requestAccess:   'Request access here',
    hasAccount:      'Already have an account?',
    enter:           'Sign in here',
  },
} satisfies Record<Lang, Record<string, string>>

type LanguageCtx = { lang: Lang; toggle: () => void; tx: typeof t['es'] }

const Ctx = createContext<LanguageCtx | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('es')
  const toggle = () => setLang(l => l === 'es' ? 'en' : 'es')
  return <Ctx.Provider value={{ lang, toggle, tx: t[lang] }}>{children}</Ctx.Provider>
}

export function useLang() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLang must be inside LanguageProvider')
  return ctx
}
