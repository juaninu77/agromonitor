'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Sprout, AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Página de registro de nuevos usuarios
 * Permite crear una cuenta en el sistema
 */
export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validar que las contraseñas coincidan
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      setLoading(false)
      return
    }

    // Validar longitud de contraseña
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: formData.nombre,
          apellido: formData.apellido,
          email: formData.email,
          telefono: formData.telefono,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear la cuenta')
      }

      setSuccess(true)
      
      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        router.push('/login')
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
        <CardContent className="pt-8 pb-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-emerald-100">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              ¡Cuenta creada exitosamente!
            </h2>
            <p className="text-gray-600">
              Redirigiendo al inicio de sesión...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
      <CardHeader className="space-y-1 text-center pb-2">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-emerald-100">
            <Sprout className="h-10 w-10 text-emerald-600" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900">
          Crear Cuenta
        </CardTitle>
        <CardDescription className="text-gray-600">
          Registrate para comenzar a usar AgroMonitor
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre" className="text-gray-700">
                Nombre
              </Label>
              <Input
                id="nombre"
                name="nombre"
                type="text"
                placeholder="Juan"
                value={formData.nombre}
                onChange={handleChange}
                required
                disabled={loading}
                className="bg-white border-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellido" className="text-gray-700">
                Apellido
              </Label>
              <Input
                id="apellido"
                name="apellido"
                type="text"
                placeholder="Pérez"
                value={formData.apellido}
                onChange={handleChange}
                required
                disabled={loading}
                className="bg-white border-gray-300"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              className="bg-white border-gray-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono" className="text-gray-700">
              Teléfono <span className="text-gray-400">(opcional)</span>
            </Label>
            <Input
              id="telefono"
              name="telefono"
              type="tel"
              placeholder="+54 11 1234-5678"
              value={formData.telefono}
              onChange={handleChange}
              disabled={loading}
              className="bg-white border-gray-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-700">
              Contraseña
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              className="bg-white border-gray-300"
            />
            <p className="text-xs text-gray-500">
              Mínimo 6 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-gray-700">
              Confirmar Contraseña
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={loading}
              className="bg-white border-gray-300"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando cuenta...
              </>
            ) : (
              'Crear Cuenta'
            )}
          </Button>

          <p className="text-center text-sm text-gray-600">
            ¿Ya tienes cuenta?{' '}
            <Link 
              href="/login" 
              className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Inicia sesión aquí
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}

