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

export function RegisterForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()
  const { t } = useLang()

  const registerSchema = z
    .object({
      name: z.string().min(2, { message: t('zodRegNameShort') }),
      email: z.string().email({ message: t('zodRegEmail') }),
      phone: z
        .string()
        .regex(/^\+?[1-9]\d{7,14}$/, { message: t('zodRegPhone') }),
      city: z.string().min(2, { message: t('zodRegCity') }),
      password: z.string().min(10, { message: t('zodRegPasswordMin') }),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('zodRegPasswordMatch'),
      path: ['confirmPassword'],
    })

  type RegisterFormValues = z.infer<typeof registerSchema>

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      city: '',
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(data: RegisterFormValues) {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          city: data.city,
          password: data.password,
        }),
      })
      const result = await response.json()

      if (response.ok && result.ok) {
        toast.success(t('registerSuccessTitle'), { description: t('registerSuccessDesc') })
        
        // Auto-login after registration
        try {
          const loginResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: data.email,
              password: data.password,
            }),
          })
          const loginResult = await loginResponse.json()

          if (loginResponse.ok && loginResult.ok && loginResult.token) {
            localStorage.setItem('sentinel_token', loginResult.token)
            localStorage.setItem('sentinel_user', JSON.stringify(loginResult.user ?? {}))
            setTimeout(() => router.push('/dashboard'), 1000)
          } else {
            // Fallback to manual login if auto-login fails
            setTimeout(() => router.push('/login'), 1200)
          }
        } catch (loginError) {
          console.error('Auto-login failed:', loginError)
          setTimeout(() => router.push('/login'), 1200)
        }
      } else {
        toast.error(t('registerErrorTitle'), {
          description: result.error ?? t('registerErrorDesc'),
        })
      }
    } catch {
      toast.error(t('registerConnErrorTitle'), { description: t('registerConnErrorDesc') })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className={styles.authHeader}>
        <h1 className={styles.authTitle}>{t('registerTitle')}</h1>
        <p className={styles.authSub}>{t('registerSub')}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono tracking-[0.2em] text-sentinel-text-3 uppercase">
                    {t('registerNameLabel')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Juan Pérez"
                      disabled={isLoading}
                      className="bg-sentinel-bg-1/50 border-sentinel-line-strong h-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono tracking-[0.2em] text-sentinel-text-3 uppercase">
                    {t('registerPhoneLabel')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+569..."
                      type="tel"
                      disabled={isLoading}
                      className="bg-sentinel-bg-1/50 border-sentinel-line-strong h-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-mono tracking-[0.2em] text-sentinel-text-3 uppercase">
                  {t('registerEmailLabel')}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('registerEmailPlaceholder')}
                    type="email"
                    autoCapitalize="none"
                    disabled={isLoading}
                    className="bg-sentinel-bg-1/50 border-sentinel-line-strong h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-mono tracking-[0.2em] text-sentinel-text-3 uppercase">
                  {t('registerCityLabel')}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('registerCityPlaceholder')}
                    disabled={isLoading}
                    className="bg-sentinel-bg-1/50 border-sentinel-line-strong h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono tracking-[0.2em] text-sentinel-text-3 uppercase">
                    {t('registerPasswordLabel')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('registerPasswordPlaceholder')}
                      type="password"
                      disabled={isLoading}
                      className="bg-sentinel-bg-1/50 border-sentinel-line-strong h-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-mono tracking-[0.2em] text-sentinel-text-3 uppercase">
                    {t('registerConfirmLabel')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('registerConfirmPlaceholder')}
                      type="password"
                      disabled={isLoading}
                      className="bg-sentinel-bg-1/50 border-sentinel-line-strong h-10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-sentinel-green hover:bg-sentinel-green-2 text-sentinel-bg-0 font-mono tracking-widest uppercase text-xs h-11 mt-4"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t('registerButton')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
