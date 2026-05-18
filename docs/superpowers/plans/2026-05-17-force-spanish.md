# Force Spanish and Remove Language Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all language switching (ES/EN) and force the application to Spanish by deleting English translations and simplifying language contexts.

**Architecture:** 
- Force `lang` to `'es'` in both `LanguageProvider` contexts.
- Remove `toggle` and `setLang` methods from contexts.
- Delete English translation objects in `translations.ts` and `language-context.tsx`.
- Remove UI elements that trigger language changes.

**Tech Stack:** React, Next.js, TypeScript

---

### Task 1: Cleanup Translations and Simplify lib/i18n Context

**Files:**
- Modify: `frontend/lib/i18n/translations.ts`
- Modify: `frontend/lib/i18n/language-context.tsx`

- [ ] **Step 1: Remove 'en' from `translations.ts`**

```typescript
// frontend/lib/i18n/translations.ts
export const translations = {
  es: {
    // ... all Spanish translations stay
  },
} as const

export type Lang = 'es'
export type TranslationKey = keyof typeof translations.es
```

- [ ] **Step 2: Force 'es' in `frontend/lib/i18n/language-context.tsx`**

```typescript
// frontend/lib/i18n/language-context.tsx
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
  const [isHydrated, setIsHydrated] = React.useState(false)

  React.useEffect(() => {
    setIsHydrated(true)
  }, [])

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
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/i18n/translations.ts frontend/lib/i18n/language-context.tsx
git commit -m "refactor(i18n): force Spanish and simplify lib context"
```

### Task 2: Simplify Global Language Context

**Files:**
- Modify: `frontend/contexts/language-context.tsx`

- [ ] **Step 1: Remove 'en' translations and `toggle` logic**

```typescript
// frontend/contexts/language-context.tsx
'use client'

import { createContext, useContext, ReactNode } from 'react'

export type Lang = 'es'

export const t = {
  es: {
    // ... keep only es
  }
}

type Tx = typeof t['es']
type LanguageCtx = { lang: Lang; tx: Tx }

const Ctx = createContext<LanguageCtx | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang: Lang = 'es'
  return <Ctx.Provider value={{ lang, tx: t[lang] }}>{children}</Ctx.Provider>
}

export function useLang() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLang must be inside LanguageProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/contexts/language-context.tsx
git commit -m "refactor(i18n): force Spanish and simplify global context"
```

### Task 3: Remove Language Toggle Components and Usages

**Files:**
- Delete: `frontend/components/login/lang-toggle.tsx`
- Modify: `frontend/app/login/page.tsx`
- Modify: `frontend/components/dashboard/top-bar.tsx`

- [ ] **Step 1: Delete `frontend/components/login/lang-toggle.tsx`**

```bash
rm frontend/components/login/lang-toggle.tsx
```

- [ ] **Step 2: Remove `LangToggle` from `frontend/app/login/page.tsx`**

Remove the import and the component usage.

- [ ] **Step 3: Remove Toggle from `frontend/components/dashboard/top-bar.tsx`**

Remove the `toggle` from `useLang()` and the `<button>` that calls it.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/login/page.tsx frontend/components/dashboard/top-bar.tsx
git rm frontend/components/login/lang-toggle.tsx
git commit -m "ui: remove language toggle components and usages"
```

### Task 4: Fix any TypeScript errors from type changes

**Files:**
- Multiple files using `useLang()`

- [ ] **Step 1: Run build to find errors**

Run: `cd frontend && npm run build` (or `npx tsc --noEmit`)

- [ ] **Step 2: Fix any component that still tries to use `toggle` or `setLang`**

- [ ] **Step 3: Commit**

```bash
git commit -m "fix(types): resolve issues after removing lang switching"
```
