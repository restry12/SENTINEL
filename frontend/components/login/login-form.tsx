'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useLang } from '@/lib/i18n/language-context'
import styles from '@/app/login/login.module.css'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function LoginForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()
  const { t } = useLang()

  const loginSchema = z.object({
    email: z.string().email({ message: t('zodLoginEmail') }),
    password: z.string().min(1, { message: t('zodLoginPassword') }),
  })

  type LoginFormValues = z.infer<typeof loginSchema>

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await response.json()

      if (response.ok && result.ok && result.token) {
        localStorage.setItem('sentinel_token', result.token)
        localStorage.setItem('sentinel_user', JSON.stringify(result.user ?? {}))
        toast.success(t('loginSuccessTitle'), { description: t('loginSuccessDesc') })
        setTimeout(() => router.push('/incendios'), 1000)
      } else {
        toast.error(t('loginErrorTitle'), {
          description: result.error ?? t('loginErrorDesc'),
        })
      }
    } catch {
      toast.error(t('loginConnErrorTitle'), { description: t('loginConnErrorDesc') })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className={styles.authHeader}>
        <h1 className={styles.authTitle}>{t('loginTitle')}</h1>
        <p className={styles.authSub}>{t('loginSub')}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10.5px] font-mono tracking-[0.2em] text-sentinel-text-3 uppercase">
                  {t('loginEmailLabel')}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('loginEmailPlaceholder')}
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={isLoading}
                    className="bg-sentinel-bg-1/50 border-sentinel-line-strong h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10.5px] font-mono tracking-[0.2em] text-sentinel-text-3 uppercase">
                  {t('loginPasswordLabel')}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="••••••••"
                    type="password"
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="bg-sentinel-bg-1/50 border-sentinel-line-strong h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-sentinel-cyan-2 hover:bg-sentinel-cyan text-sentinel-bg-0 font-mono tracking-widest uppercase text-xs h-11 mt-6"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('loginButton')}
          </Button>
        </form>
      </Form>

      <div className={styles.divider}>{t('loginDivider')}</div>

      <Button
        variant="outline"
        type="button"
        disabled={isLoading}
        onClick={() => {
          localStorage.setItem('sentinel_token', 'demo')
          router.push('/incendios')
        }}
        className="w-full h-11 border border-orange/30 bg-orange/5 hover:bg-orange/10 hover:border-orange/50 text-orange font-mono tracking-widest uppercase text-[10px] transition-all duration-200 shadow-[0_0_20px_rgba(255,126,21,0.08)] hover:shadow-[0_0_24px_rgba(255,126,21,0.18)]"
      >
        {t('loginDemo')}
      </Button>
    </div>
  )
}
