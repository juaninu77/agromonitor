'use client'

import { use, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { signIn, signOut, useSession } from 'next-auth/react'
import { AlertCircle, CheckCircle2, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthHeader } from '@/components/auth/auth-header'
import { PasswordInput } from '@/components/auth/password-input'
import { ROL_INFO, type RolOrg } from '@/lib/equipo/roles'

interface Invitacion {
  organizacion: string
  email: string
  rol: RolOrg
  invitadoPor: string
  mensaje: string | null
  campos: string[] | null
  expiraAt: string
  tieneCuenta: boolean
}

const INPUT_CLASS = 'bg-white border-gray-300 text-gray-900 focus-visible:ring-emerald-500'

/**
 * Pantalla del enlace de invitación:
 * - sin cuenta: crear la cuenta acá (entra directo al espacio compartido, sin organización propia);
 * - con cuenta: iniciar sesión con ese email y aceptar.
 */
export default function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { data: session, status } = useSession()
  const [inv, setInv] = useState<Invitacion | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [form, setForm] = useState({ nombre: '', apellido: '', password: '' })

  useEffect(() => {
    fetch(`/api/invitaciones/${encodeURIComponent(token)}`)
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error ?? 'No se pudo abrir la invitación'); setInv(b.data) })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [token])

  const emailSesion = session?.user?.email?.toLowerCase()
  const esLaCuenta = !!inv && emailSesion === inv.email.toLowerCase()

  async function entrar(organizacionId: string) {
    localStorage.setItem('organizacionActivaId', organizacionId)
    localStorage.removeItem('establecimientoActivoId')
    window.location.assign('/')
  }

  async function aceptar() {
    setEnviando(true); setError('')
    try {
      const r = await fetch(`/api/invitaciones/${encodeURIComponent(token)}`, { method: 'POST' })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? 'No se pudo aceptar la invitación')
      await entrar(b.data.organizacionId)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo aceptar'); setEnviando(false) }
  }

  async function crearCuenta(e: FormEvent) {
    e.preventDefault()
    setEnviando(true); setError('')
    try {
      const r = await fetch(`/api/invitaciones/${encodeURIComponent(token)}/registro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? 'No se pudo crear la cuenta')
      const login = await signIn('credentials', { email: b.data.email, password: form.password, redirect: false })
      if (!login || login.error) { window.location.assign(`/login?registrado=1&email=${encodeURIComponent(b.data.email)}`); return }
      await entrar(b.data.organizacionId)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta'); setEnviando(false) }
  }

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
      <AuthHeader title="Invitación a AgroMonitor" icon={Users} description={inv ? <>Te invitaron a <strong>{inv.organizacion}</strong></> : undefined} />
      <CardContent className="space-y-4 text-gray-900">
        {cargando || status === 'loading' ? (
          <p className="flex items-center justify-center gap-2 py-6 text-gray-600" role="status"><Loader2 className="h-4 w-4 animate-spin" />Abriendo la invitación…</p>
        ) : !inv ? (
          <Alert variant="destructive" className="bg-red-50 border-red-200" role="alert"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
        ) : (
          <>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
              <p><strong>{inv.invitadoPor}</strong> te invitó como <strong>{ROL_INFO[inv.rol].label.toLowerCase()}</strong>.</p>
              <p className="mt-1 text-emerald-900/80">{ROL_INFO[inv.rol].descripcion}</p>
              <p className="mt-1">{inv.campos ? `Campos: ${inv.campos.join(', ')}` : 'Acceso a todos los campos de la organización.'}</p>
              {inv.mensaje && <p className="mt-2 italic">“{inv.mensaje}”</p>}
            </div>
            {error && <Alert variant="destructive" className="bg-red-50 border-red-200" role="alert"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

            {session?.user ? (
              esLaCuenta ? (
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={enviando} onClick={aceptar}>
                  {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Aceptar y entrar
                </Button>
              ) : (
                <div className="space-y-3 text-sm">
                  <p>La invitación es para <strong>{inv.email}</strong> y entraste como <strong>{session.user.email}</strong>.</p>
                  <Button variant="outline" className="w-full" onClick={() => signOut({ callbackUrl: `/login?email=${encodeURIComponent(inv.email)}&callbackUrl=${encodeURIComponent(`/invitacion/${token}`)}` })}>Cerrar sesión e ingresar con {inv.email}</Button>
                </div>
              )
            ) : inv.tieneCuenta ? (
              <div className="space-y-3 text-sm">
                <p>Ya tenés una cuenta con <strong>{inv.email}</strong>. Iniciá sesión para aceptar.</p>
                <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <Link href={`/login?email=${encodeURIComponent(inv.email)}&callbackUrl=${encodeURIComponent(`/invitacion/${token}`)}`}>Iniciar sesión y aceptar</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={crearCuenta} className="space-y-3" noValidate>
                <p className="text-sm">Creá tu cuenta para <strong>{inv.email}</strong>:</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="inv-nombre">Nombre</Label><Input id="inv-nombre" className={INPUT_CLASS} required autoComplete="given-name" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="inv-apellido">Apellido</Label><Input id="inv-apellido" className={INPUT_CLASS} required autoComplete="family-name" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-password">Contraseña</Label>
                  <PasswordInput id="inv-password" className={INPUT_CLASS} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <p className="text-xs text-gray-600">Al menos 8 caracteres, con letras y números.</p>
                </div>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={enviando}>
                  {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear cuenta y entrar
                </Button>
              </form>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="justify-center text-xs text-gray-500">
        {inv && `La invitación vence el ${new Date(inv.expiraAt).toLocaleDateString('es-AR')}.`}
      </CardFooter>
    </Card>
  )
}
