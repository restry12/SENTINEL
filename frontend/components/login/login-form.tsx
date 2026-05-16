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
import styles from '@/app/login/login.module.css'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const loginSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(1, { message: 'Contraseña requerida' }),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        toast.success('Acceso concedido', {
          description: 'Sincronizando con el centro de comando...',
        })
        // Small delay to show the toast
        setTimeout(() => {
          router.push('/dashboard')
        }, 1000)
      } else {
        toast.error('Error de acceso', {
          description: 'Credenciales inválidas o cuenta no autorizada.',
        })
      }
    } catch (error) {
      toast.error('Error de conexión', {
        description: 'No se pudo contactar con el servidor de autenticación.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className={styles.authHeader}>
        <h1 className={styles.authTitle}>Bienvenido a SENTINEL</h1>
        <p className={styles.authSub}>
          Ingrese sus credenciales para acceder al comando central de monitoreo.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10.5px] font-mono tracking-[0.2em] text-sentinel-text-3 uppercase">
                  Email de Operador
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="operador@sentinel.air"
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
                  Clave de Acceso
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
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'Iniciar Sesión'
            )}
          </Button>
        </form>
      </Form>

      <div className={styles.divider}>O continúa sin cuenta</div>

      <Button
        variant="outline"
        type="button"
        disabled={isLoading}
        onClick={() => router.push('/dashboard')}
        className="w-full h-11 border border-orange/30 bg-orange/5 hover:bg-orange/10 hover:border-orange/50 text-orange font-mono tracking-widest uppercase text-[10px] transition-all duration-200 shadow-[0_0_20px_rgba(255,126,21,0.08)] hover:shadow-[0_0_24px_rgba(255,126,21,0.18)]"
      >
        Ver Demo →
      </Button>
    </div>
  )
}
