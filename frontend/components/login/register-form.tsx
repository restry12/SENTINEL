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

const registerSchema = z
  .object({
    name: z.string().min(2, { message: 'Nombre demasiado corto' }),
    email: z.string().email({ message: 'Email inválido' }),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{7,14}$/, { message: 'Número de teléfono inválido (ej: +56912345678)' }),
    city: z.string().min(2, { message: 'Comuna/Ciudad requerida' }),
    password: z.string().min(10, { message: 'La clave debe tener al menos 10 caracteres' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las claves no coinciden',
    path: ['confirmPassword'],
  })

type RegisterFormValues = z.infer<typeof registerSchema>

export function RegisterForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()

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
        toast.success('Cuenta creada', {
          description: 'Cuenta registrada. Inicie sesión para continuar.',
        })
        setTimeout(() => {
          router.push('/login')
        }, 1200)
      } else {
        toast.error('Error de registro', {
          description: result.error ?? 'No se pudo crear la cuenta.',
        })
      }
    } catch (error) {
      toast.error('Error de conexión', {
        description: 'No se pudo contactar el servidor de autenticación.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className={styles.authHeader}>
        <h1 className={styles.authTitle}>Registro de Operador</h1>
        <p className={styles.authSub}>
          Cree su cuenta para recibir alertas críticas y gestionar zonas de cobertura.
        </p>
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
                    Nombre Completo
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
                    Teléfono (Alertas)
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
                  Email Institucional
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="operador@institucion.cl"
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
                  Comuna / Ciudad
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ej: Valparaíso"
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
                    Clave
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Min. 10 car."
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
                    Confirmar
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Repetir clave"
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
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'Crear Cuenta Operativa'
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}
