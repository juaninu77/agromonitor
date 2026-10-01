'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthHeader } from '@/components/auth/auth-header'
import { FieldError } from '@/components/auth/field-error'
import { PasswordInput } from '@/components/auth/password-input'
import { PasswordRequirements } from '@/components/auth/password-requirements'
import { registerFormSchema, type RegisterFormInput } from '@/lib/validations/auth-schema'

const INPUT_CLASS =
  'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus-visible:ring-emerald-500 aria-[invalid=true]:border-red-400'

type CampoRegistro = keyof RegisterFormInput

/**
 * Página de registro de nuevos usuarios.
 * Crea la cuenta, inicia sesión automáticamente y lleva al onboarding.
 */
export default function RegisterPage() {
  const [error, setError] = useState('')
  const [creada, setCreada] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
    mode: 'onTouched',
    defaultValues: {
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      password: '',
      confirmPassword: '',
    },
  })

  const password = watch('password') ?? ''
  const bloqueado = isSubmitting || creada

  const onSubmit = async ({ confirmPassword: _confirm, ...data }: RegisterFormInput) => {
    setError('')

    let response: Response
    let body: { error?: string; fieldErrors?: Partial<Record<CampoRegistro, string[]>> }
    try {
      response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      body = await response.json().catch(() => ({}))
    } catch {
      setError('No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.')
      return
    }

    if (!response.ok) {
      // Errores por campo devueltos por el servidor (ej. email duplicado)
      let marcoCampo = false
      for (const [campo, mensajes] of Object.entries(body.fieldErrors ?? {})) {
        if (mensajes?.[0]) {
          setFieldError(campo as CampoRegistro, { message: mensajes[0] }, { shouldFocus: !marcoCampo })
          marcoCampo = true
        }
      }
      if (!marcoCampo) setError(body.error || 'No pudimos crear la cuenta. Intentá de nuevo.')
      return
    }

    setCreada(true)

    // Login automático; si falla, al login con el email precargado
    const email = data.email.trim().toLowerCase()
    try {
      const result = await signIn('credentials', {
        email,
        password: data.password,
        redirect: false,
      })
      if (result?.ok && !result.error) {
        window.location.assign('/configuracion/onboarding')
        return
      }
    } catch {
      // se maneja abajo
    }
    window.location.assign(`/login?registrado=1&email=${encodeURIComponent(email)}`)
  }

  if (creada) {
    return (
      <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
        <CardContent className="pt-8 pb-8">
          <div className="text-center space-y-4" role="status">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-emerald-100">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">¡Cuenta creada!</h2>
            <p className="text-gray-600 text-sm flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparando tu espacio de trabajo...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const campo = (name: CampoRegistro) => ({
    id: name,
    disabled: bloqueado,
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    className: INPUT_CLASS,
    ...register(name),
  })

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
      <AuthHeader title="Crear cuenta" description="Registrate para comenzar a usar AgroMonitor" />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="bg-red-50 border-red-200" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre" className="text-gray-700">
                Nombre
              </Label>
              <Input type="text" autoComplete="given-name" autoFocus placeholder="Juan" {...campo('nombre')} />
              <FieldError id="nombre-error" message={errors.nombre?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellido" className="text-gray-700">
                Apellido
              </Label>
              <Input type="text" autoComplete="family-name" placeholder="Pérez" {...campo('apellido')} />
              <FieldError id="apellido-error" message={errors.apellido?.message} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700">
              Email
            </Label>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="tu@email.com"
              {...campo('email')}
            />
            <FieldError id="email-error" message={errors.email?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono" className="text-gray-700">
              Teléfono <span className="text-gray-400">(opcional)</span>
            </Label>
            <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+54 11 1234-5678" {...campo('telefono')} />
            <FieldError id="telefono-error" message={errors.telefono?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-700">
              Contraseña
            </Label>
            <PasswordInput
              autoComplete="new-password"
              placeholder="••••••••"
              avisarBloqMayus
              {...campo('password')}
              aria-describedby={['password-requisitos', errors.password ? 'password-error' : null]
                .filter(Boolean)
                .join(' ')}
            />
            <PasswordRequirements id="password-requisitos" password={password} />
            <FieldError id="password-error" message={errors.password?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-gray-700">
              Confirmar contraseña
            </Label>
            <PasswordInput autoComplete="new-password" placeholder="••••••••" {...campo('confirmPassword')} />
            <FieldError id="confirmPassword-error" message={errors.confirmPassword?.message} />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5"
            disabled={bloqueado}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando cuenta...
              </>
            ) : (
              'Crear cuenta'
            )}
          </Button>

          <p className="text-center text-sm text-gray-600">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
