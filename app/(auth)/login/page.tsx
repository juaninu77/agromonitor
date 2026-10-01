'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
import {
  callbackUrlSeguro,
  loginSchema,
  mensajeErrorLogin,
  type LoginInput,
} from '@/lib/validations/auth-schema'

const INPUT_CLASS =
  'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus-visible:ring-emerald-500 aria-[invalid=true]:border-red-400'

/**
 * Formulario de inicio de sesión con email y contraseña.
 * Tras autenticar vuelve a la ruta pedida originalmente (`callbackUrl`).
 */
function LoginForm() {
  const searchParams = useSearchParams()
  const callbackUrl = callbackUrlSeguro(searchParams.get('callbackUrl'))
  const emailInicial = searchParams.get('email') ?? ''
  const recienRegistrado = searchParams.get('registrado') === '1'

  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: emailInicial, password: '' },
  })

  // Deshabilitado también después de un login exitoso, mientras navega
  const bloqueado = isSubmitting || (isSubmitSuccessful && !error)

  const onSubmit = async (data: LoginInput) => {
    setError('')

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (!result || result.error) {
        setError(mensajeErrorLogin(result?.error, result?.code))
        setFocus('password')
        return
      }

      // Navegación completa para que el layout lea la sesión nueva
      window.location.assign(callbackUrl)
    } catch {
      setError(mensajeErrorLogin('Configuration'))
    }
  }

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
      <AuthHeader title="AgroMonitor ERP" description="Ingresá tus credenciales para acceder" />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-4">
          {recienRegistrado && !error && (
            <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
              <CheckCircle2 className="h-4 w-4 !text-emerald-600" />
              <AlertDescription>Tu cuenta fue creada. Iniciá sesión para continuar.</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="bg-red-50 border-red-200" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus={!emailInicial}
              placeholder="tu@email.com"
              disabled={bloqueado}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={INPUT_CLASS}
              {...register('email')}
            />
            <FieldError id="email-error" message={errors.email?.message} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-gray-700">
                Contraseña
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              autoFocus={!!emailInicial}
              placeholder="••••••••"
              avisarBloqMayus
              disabled={bloqueado}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className={INPUT_CLASS}
              {...register('password')}
            />
            <FieldError id="password-error" message={errors.password?.message} />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5"
            disabled={bloqueado}
          >
            {bloqueado ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ingresando...
              </>
            ) : (
              'Iniciar sesión'
            )}
          </Button>

          <p className="text-center text-sm text-gray-600">
            ¿No tenés cuenta?{' '}
            <Link
              href="/register"
              className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Registrate
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
          <CardContent className="pt-8 pb-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </CardContent>
        </Card>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
