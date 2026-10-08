"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Building2, KeyRound, Loader2, LogIn, Plus, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { PasswordInput } from "@/components/auth/password-input"
import { useTenant } from "@/lib/context/tenant-context"
import { ROL_INFO, type RolOrg } from "@/lib/equipo/roles"

interface Cuenta {
  perfil: { id: string; nombre: string; apellido: string; email: string; telefono: string | null; emailVerificado: boolean }
  espacios: { membresiaId: string; organizacionId: string; nombre: string; rol: RolOrg; esActivo: boolean; campos: number; accesoTotal: boolean; miembros: number }[]
  invitaciones: { id: string; organizacion: string; rol: RolOrg; invitadoPor: string; expiraAt: string; aceptarSinEnlace: boolean }[]
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo completar la operación")
  return (b.data ?? b) as T
}
const msg = (e: unknown) => (e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se guardó")

export function CuentaWorkspace() {
  const client = useQueryClient()
  const { update } = useSession()
  const { organizacionActiva, setOrganizacionActiva, organizaciones, recargarOrganizaciones } = useTenant()
  const q = useQuery({ queryKey: ["mi-cuenta"], queryFn: () => api<Cuenta>("/api/cuenta") })
  const [perfil, setPerfil] = useState({ nombre: "", apellido: "", telefono: "" })
  const [pass, setPass] = useState({ actual: "", nueva: "", repetir: "" })
  const [nuevoEspacio, setNuevoEspacio] = useState("")
  const [guardando, setGuardando] = useState<string | null>(null)

  useEffect(() => {
    if (q.data) setPerfil({ nombre: q.data.perfil.nombre, apellido: q.data.perfil.apellido, telefono: q.data.perfil.telefono ?? "" })
  }, [q.data])

  async function accion(clave: string, fn: () => Promise<unknown>, ok: string) {
    setGuardando(clave)
    try { await fn(); toast.success(ok); await client.invalidateQueries({ queryKey: ["mi-cuenta"] }); return true } catch (e) { toast.error(msg(e)); return false } finally { setGuardando(null) }
  }
  const guardarPerfil = (e: FormEvent) => { e.preventDefault(); void accion("perfil", async () => { await api("/api/cuenta", { method: "PATCH", body: JSON.stringify(perfil) }); await update({ nombre: perfil.nombre, apellido: perfil.apellido }) }, "Perfil actualizado") }
  async function cambiarPassword(e: FormEvent) {
    e.preventDefault()
    if (pass.nueva !== pass.repetir) { toast.error("Las contraseñas nuevas no coinciden"); return }
    if (await accion("pass", () => api("/api/cuenta/password", { method: "POST", body: JSON.stringify({ actual: pass.actual, nueva: pass.nueva }) }), "Contraseña cambiada")) setPass({ actual: "", nueva: "", repetir: "" })
  }
  async function crearEspacio(e: FormEvent) {
    e.preventDefault()
    let nueva: { id: string } | null = null
    const ok = await accion("espacio", async () => { nueva = await api<{ id: string }>("/api/organizaciones", { method: "POST", body: JSON.stringify({ nombre: nuevoEspacio }) }) }, "Espacio creado: cargá su primer campo")
    if (ok && nueva) { setNuevoEspacio(""); await recargarOrganizaciones((nueva as { id: string }).id); window.location.assign("/configuracion/onboarding") }
  }
  async function aceptar(id: string) {
    let r: { organizacionId: string } | null = null
    const ok = await accion(`inv-${id}`, async () => { r = await api<{ organizacionId: string }>(`/api/cuenta/invitaciones/${id}`, { method: "POST" }) }, "Te sumaste al espacio")
    if (ok && r) await recargarOrganizaciones((r as { organizacionId: string }).organizacionId)
  }
  function entrar(organizacionId: string) {
    const org = organizaciones.find((o) => o.id === organizacionId)
    if (org) { setOrganizacionActiva(org); toast.success(`Estás en ${org.nombre}`) }
  }

  if (q.isPending) return <p role="status">Cargando tu cuenta…</p>
  if (q.isError) return <p role="alert" className="erp-error">{q.error.message} <button className="underline" onClick={() => q.refetch()}>Reintentar</button></p>
  const d = q.data

  return (
    <div className="space-y-6">
      <PageHeading title="Mi cuenta" icon={UserRound} context={d.perfil.email} description="Tus datos, tu contraseña y los espacios de trabajo que compartís con otras personas." />

      <section className="space-y-3" aria-label="Mis espacios">
        <h2 className="text-lg font-semibold">Mis espacios de trabajo</h2>
        <p className="text-sm text-muted-foreground">Cada espacio (organización) tiene sus campos, datos y equipo. Podés estar en varios con roles distintos y cambiar desde el selector de arriba.</p>
        {d.invitaciones.length > 0 && (
          <Card className="border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20">
            <CardHeader className="pb-2"><CardTitle className="text-base">Invitaciones para vos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {d.invitaciones.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span><strong>{i.organizacion}</strong> · {ROL_INFO[i.rol].label} · invitó {i.invitadoPor}</span>
                  {i.aceptarSinEnlace
                    ? <Button size="sm" disabled={guardando === `inv-${i.id}`} onClick={() => aceptar(i.id)}>Aceptar</Button>
                    : <span className="text-xs text-muted-foreground">Abrí el enlace que te compartieron para aceptarla.</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {d.espacios.map((e) => {
            const activo = organizacionActiva?.id === e.organizacionId
            return (
              <Card key={e.membresiaId} className={activo ? "border-primary" : ""}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4" />{e.nombre}</p>
                    <div className="flex gap-1">{activo && <Badge>Actual</Badge>}<Badge variant="outline">{ROL_INFO[e.rol].label}</Badge>{!e.esActivo && <Badge variant="destructive">Acceso pausado</Badge>}</div>
                  </div>
                  <p className="text-sm text-muted-foreground">{e.miembros} {e.miembros === 1 ? "miembro" : "miembros"} · {e.accesoTotal ? `${e.campos} ${e.campos === 1 ? "campo" : "campos"}` : `acceso a ${e.campos} ${e.campos === 1 ? "campo" : "campos"}`}</p>
                  <div className="flex flex-wrap gap-2">
                    {!activo && e.esActivo && <Button size="sm" variant="outline" onClick={() => entrar(e.organizacionId)}><LogIn className="h-4 w-4" />Entrar</Button>}
                    {activo && <Button size="sm" variant="outline" asChild><Link href="/configuracion/equipo">Ver equipo</Link></Button>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        <form onSubmit={crearEspacio} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5"><Label htmlFor="nuevo-espacio">Crear un espacio nuevo</Label><Input id="nuevo-espacio" className="w-72 max-w-full" minLength={2} maxLength={120} required placeholder="Ej.: Campo de la familia" value={nuevoEspacio} onChange={(e) => setNuevoEspacio(e.target.value)} /></div>
          <Button type="submit" variant="outline" disabled={guardando === "espacio"}><Plus className="h-4 w-4" />Crear</Button>
        </form>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Mis datos</CardTitle><CardDescription>Así te ven los demás miembros. El email es tu usuario para entrar.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={guardarPerfil} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="cta-nombre">Nombre</Label><Input id="cta-nombre" required maxLength={80} value={perfil.nombre} onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="cta-apellido">Apellido</Label><Input id="cta-apellido" required maxLength={80} value={perfil.apellido} onChange={(e) => setPerfil({ ...perfil, apellido: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="cta-tel">Teléfono</Label><Input id="cta-tel" inputMode="tel" maxLength={30} value={perfil.telefono} onChange={(e) => setPerfil({ ...perfil, telefono: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="cta-email">Email</Label><Input id="cta-email" value={d.perfil.email} readOnly disabled /></div>
              <Button type="submit" disabled={guardando === "perfil"}>{guardando === "perfil" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" />Contraseña</CardTitle><CardDescription>Al menos 8 caracteres, con letras y números.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={cambiarPassword} className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="pw-actual">Contraseña actual</Label><PasswordInput id="pw-actual" required autoComplete="current-password" value={pass.actual} onChange={(e) => setPass({ ...pass, actual: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="pw-nueva">Nueva contraseña</Label><PasswordInput id="pw-nueva" required autoComplete="new-password" value={pass.nueva} onChange={(e) => setPass({ ...pass, nueva: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="pw-repetir">Repetir nueva contraseña</Label><PasswordInput id="pw-repetir" required autoComplete="new-password" value={pass.repetir} onChange={(e) => setPass({ ...pass, repetir: e.target.value })} /></div>
              <Button type="submit" disabled={guardando === "pass"}>{guardando === "pass" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cambiar contraseña</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
