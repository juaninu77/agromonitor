"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, Copy, Link2, Loader2, MailCheck, MessageCircle, Pencil, Shield, UserMinus, UserPlus, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { useTenant } from "@/lib/context/tenant-context"
import { esGestor, puedeGestionar, ROL_INFO, ROLES_INVITABLES, ROLES_ORG, type RolOrg } from "@/lib/equipo/roles"

interface Miembro { id: string; usuarioId: string; nombre: string; apellido: string; email: string | null; rol: RolOrg; esActivo: boolean; accesoTotal: boolean; establecimientoIds: string[]; soyYo: boolean; desde: string }
interface Invitacion { id: string; email: string; rol: RolOrg; accesoTotal: boolean; establecimientoIds: string[]; vencida: boolean; expiraAt: string; invitadoPor: string }
interface Equipo { organizacion: { id: string; nombre: string }; miRol: RolOrg; puedeGestionar: boolean; campos: { id: string; nombre: string }[]; miembros: Miembro[]; invitaciones: Invitacion[] }
interface EnlaceGenerado { email: string; enlace: string; texto: string; emailEnviado: boolean }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo completar la operación")
  return b.data as T
}
const msg = (e: unknown) => (e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se guardó")
const tonoRol: Record<RolOrg, string> = { propietario: "bg-emerald-100 text-emerald-900", admin: "bg-sky-100 text-sky-900", encargado: "bg-amber-100 text-amber-900", vet: "bg-violet-100 text-violet-900", operario: "bg-muted text-foreground" }

export function EquipoWorkspace() {
  const { organizacionActiva, isLoading, recargarOrganizaciones } = useTenant()
  if (isLoading) return <p role="status">Cargando…</p>
  if (!organizacionActiva) return <p>Elegí una organización en el selector superior.</p>
  return <Equipo key={organizacionActiva.id} orgId={organizacionActiva.id} onCambioOrg={() => recargarOrganizaciones(organizacionActiva.id)} />
}

function Equipo({ orgId, onCambioOrg }: { orgId: string; onCambioOrg: () => void }) {
  const client = useQueryClient()
  const q = useQuery({ queryKey: ["equipo", orgId], queryFn: () => api<Equipo>(`/api/organizaciones/${orgId}/equipo`) })
  const [invitando, setInvitando] = useState(false)
  const [editando, setEditando] = useState<Miembro | null>(null)
  const [enlace, setEnlace] = useState<EnlaceGenerado | null>(null)
  const [renombrando, setRenombrando] = useState(false)
  const recargar = () => client.invalidateQueries({ queryKey: ["equipo", orgId] })

  if (q.isPending) return <p role="status">Cargando equipo…</p>
  if (q.isError) return <p role="alert" className="erp-error">{q.error.message} <button className="underline" onClick={() => q.refetch()}>Reintentar</button></p>
  const d = q.data
  const nombreCampo = (id: string) => d.campos.find((c) => c.id === id)?.nombre ?? "campo"
  const yo = d.miembros.find((m) => m.soyYo)

  async function quitar(m: Miembro) {
    const propio = m.soyYo
    if (!window.confirm(propio ? `¿Salir de «${d.organizacion.nombre}»? Vas a dejar de ver sus datos.` : `¿Quitar a ${m.nombre} ${m.apellido} de la organización? Sus registros quedan; deja de tener acceso.`)) return
    try {
      await api(`/api/organizaciones/${orgId}/miembros/${m.id}`, { method: "DELETE" })
      toast.success(propio ? "Saliste de la organización" : "Miembro quitado")
      if (propio) { localStorage.removeItem("organizacionActivaId"); window.location.assign("/configuracion/cuenta") } else recargar()
    } catch (e) { toast.error(msg(e)) }
  }
  async function activar(m: Miembro, esActivo: boolean) {
    try { await api(`/api/organizaciones/${orgId}/miembros/${m.id}`, { method: "PATCH", body: JSON.stringify({ esActivo }) }); toast.success(esActivo ? "Acceso reactivado" : "Acceso pausado"); recargar() } catch (e) { toast.error(msg(e)) }
  }
  async function anular(i: Invitacion) {
    if (!window.confirm(`¿Anular la invitación a ${i.email}? El enlace deja de funcionar.`)) return
    try { await api(`/api/organizaciones/${orgId}/invitaciones/${i.id}`, { method: "DELETE" }); toast.success("Invitación anulada"); recargar() } catch (e) { toast.error(msg(e)) }
  }
  async function nuevoEnlace(i: Invitacion) {
    try { const r = await api<EnlaceGenerado>(`/api/organizaciones/${orgId}/invitaciones/${i.id}/regenerar`, { method: "POST" }); setEnlace({ ...r, email: i.email }); recargar() } catch (e) { toast.error(msg(e)) }
  }

  return (
    <div className="space-y-6">
      <PageHeading title="Equipo y permisos" icon={Users} context={d.organizacion.nombre}
        description="Sumá a las personas con las que trabajás: cada una entra con su cuenta y ve los mismos datos, según su rol."
        actions={d.puedeGestionar && <Button onClick={() => setInvitando(true)}><UserPlus />Invitar persona</Button>} />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{d.organizacion.nombre}</CardTitle>
            <CardDescription>Tu rol: <strong>{ROL_INFO[d.miRol].label}</strong> · {d.miembros.filter((m) => m.esActivo).length} miembros activos · {d.campos.length} {d.campos.length === 1 ? "campo" : "campos"}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {d.puedeGestionar && <Button size="sm" variant="outline" onClick={() => setRenombrando(true)}><Pencil className="h-4 w-4" />Renombrar</Button>}
            <Button size="sm" variant="ghost" asChild><Link href="/configuracion/cuenta">Mi cuenta y espacios</Link></Button>
          </div>
        </CardHeader>
      </Card>

      <section className="space-y-3" aria-label="Miembros">
        <h2 className="text-lg font-semibold">Miembros</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {d.miembros.map((m) => {
            const gestionable = !m.soyYo && yo && puedeGestionar(yo.rol, m.rol, m.rol)
            return (
              <Card key={m.id} className={m.esActivo ? "" : "opacity-70"}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{m.nombre} {m.apellido} {m.soyYo && <Badge variant="outline" className="ml-1">Vos</Badge>}</div>
                      {m.email && <p className="truncate text-sm text-muted-foreground">{m.email}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge className={tonoRol[m.rol]}>{ROL_INFO[m.rol].label}</Badge>
                      {!m.esActivo && <Badge variant="destructive">Acceso pausado</Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{m.accesoTotal || esGestor(m.rol) ? "Todos los campos" : `Campos: ${m.establecimientoIds.map(nombreCampo).join(", ")}`}</p>
                  <div className="flex flex-wrap gap-2">
                    {gestionable && <Button size="sm" variant="outline" onClick={() => setEditando(m)}><Shield className="h-4 w-4" />Rol y campos</Button>}
                    {gestionable && <Button size="sm" variant="ghost" onClick={() => activar(m, !m.esActivo)}>{m.esActivo ? "Pausar acceso" : "Reactivar"}</Button>}
                    {(gestionable || m.soyYo) && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => quitar(m)}><UserMinus className="h-4 w-4" />{m.soyYo ? "Salir" : "Quitar"}</Button>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {d.puedeGestionar && (
        <section className="space-y-3" aria-label="Invitaciones pendientes">
          <h2 className="text-lg font-semibold">Invitaciones pendientes</h2>
          {!d.invitaciones.length ? <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p> : (
            <div className="grid gap-3 lg:grid-cols-2">
              {d.invitaciones.map((i) => (
                <Card key={i.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="truncate font-medium">{i.email}</p>
                      <Badge className={tonoRol[i.rol]}>{ROL_INFO[i.rol].label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{i.vencida ? "Vencida" : `Vence el ${new Date(i.expiraAt).toLocaleDateString("es-AR")}`} · invitó {i.invitadoPor}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => nuevoEnlace(i)}><Link2 className="h-4 w-4" />{i.vencida ? "Renovar enlace" : "Nuevo enlace"}</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => anular(i)}>Anular</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg border p-4 text-sm" aria-label="Qué puede hacer cada rol">
        <h2 className="mb-2 font-semibold">Qué puede hacer cada rol</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          {ROLES_ORG.map((r) => <div key={r}><dt className="font-medium">{ROL_INFO[r].label}</dt><dd className="text-muted-foreground">{ROL_INFO[r].descripcion}</dd></div>)}
        </dl>
      </section>

      {invitando && yo && <InvitarDialog orgId={orgId} miRol={yo.rol} campos={d.campos} onClose={() => setInvitando(false)} onListo={(e) => { setInvitando(false); setEnlace(e); recargar() }} />}
      {editando && yo && <MiembroDialog orgId={orgId} miRol={yo.rol} campos={d.campos} miembro={editando} onClose={() => setEditando(null)} onListo={() => { setEditando(null); recargar() }} />}
      {renombrando && <RenombrarDialog orgId={orgId} nombre={d.organizacion.nombre} onClose={() => setRenombrando(false)} onListo={() => { setRenombrando(false); recargar(); onCambioOrg() }} />}
      <EnlaceDialog enlace={enlace} onClose={() => setEnlace(null)} />
    </div>
  )
}

function CamposSelector({ campos, accesoTotal, elegidos, onChange }: { campos: { id: string; nombre: string }[]; accesoTotal: boolean; elegidos: string[]; onChange: (accesoTotal: boolean, elegidos: string[]) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Acceso a campos</legend>
      <label className="flex items-center gap-2 text-sm"><input type="radio" checked={accesoTotal} onChange={() => onChange(true, elegidos)} />Todos los campos (también los que se creen después)</label>
      <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!accesoTotal} onChange={() => onChange(false, elegidos)} />Solo algunos campos</label>
      {!accesoTotal && (
        <div className="ml-6 grid gap-1 sm:grid-cols-2">
          {campos.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={elegidos.includes(c.id)} onChange={(e) => onChange(false, e.target.checked ? [...elegidos, c.id] : elegidos.filter((x) => x !== c.id))} />{c.nombre}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}

function RolSelector({ roles, valor, onChange }: { roles: readonly RolOrg[]; valor: RolOrg; onChange: (r: RolOrg) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Rol</legend>
      {roles.map((r) => (
        <label key={r} className={`flex cursor-pointer gap-2 rounded-md border p-2 text-sm ${valor === r ? "border-primary bg-primary/5" : ""}`}>
          <input type="radio" name="rol" className="mt-1" checked={valor === r} onChange={() => onChange(r)} />
          <span><strong>{ROL_INFO[r].label}</strong><span className="block text-muted-foreground">{ROL_INFO[r].descripcion}</span></span>
        </label>
      ))}
    </fieldset>
  )
}

function InvitarDialog({ orgId, miRol, campos, onClose, onListo }: { orgId: string; miRol: RolOrg; campos: { id: string; nombre: string }[]; onClose: () => void; onListo: (e: EnlaceGenerado) => void }) {
  const [email, setEmail] = useState(""), [rol, setRol] = useState<RolOrg>("encargado"), [mensaje, setMensaje] = useState("")
  const [acceso, setAcceso] = useState<{ total: boolean; ids: string[] }>({ total: true, ids: [] })
  const [guardando, setGuardando] = useState(false), [error, setError] = useState("")
  const roles = ROLES_INVITABLES.filter((r) => puedeGestionar(miRol, null, r))
  const parcial = !acceso.total && !esGestor(rol)
  async function submit(e: FormEvent) {
    e.preventDefault(); setGuardando(true); setError("")
    try {
      const r = await api<EnlaceGenerado>(`/api/organizaciones/${orgId}/invitaciones`, { method: "POST", body: JSON.stringify({ email, rol, mensaje: mensaje || null, accesoTotal: !parcial, establecimientoIds: parcial ? acceso.ids : [] }) })
      onListo({ ...r, email })
    } catch (e) { setError(msg(e)) } finally { setGuardando(false) }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Invitar persona</DialogTitle><DialogDescription>Le generamos un enlace para que se sume con su propia cuenta. Vence en 7 días.</DialogDescription></DialogHeader>
        <form id="invitar" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="inv-email">Email</Label><Input id="inv-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" /></div>
          <RolSelector roles={roles} valor={rol} onChange={setRol} />
          {!esGestor(rol) && campos.length > 1 && <CamposSelector campos={campos} accesoTotal={acceso.total} elegidos={acceso.ids} onChange={(total, ids) => setAcceso({ total, ids })} />}
          <div className="space-y-1.5"><Label htmlFor="inv-msg">Mensaje (opcional)</Label><Input id="inv-msg" maxLength={500} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Ej.: Te sumo para que cargues la manga" /></div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button><Button type="submit" form="invitar" disabled={guardando}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear invitación</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MiembroDialog({ orgId, miRol, campos, miembro, onClose, onListo }: { orgId: string; miRol: RolOrg; campos: { id: string; nombre: string }[]; miembro: Miembro; onClose: () => void; onListo: () => void }) {
  const [rol, setRol] = useState<RolOrg>(miembro.rol)
  const [acceso, setAcceso] = useState({ total: miembro.accesoTotal, ids: miembro.establecimientoIds })
  const [guardando, setGuardando] = useState(false), [error, setError] = useState("")
  const roles = ROLES_ORG.filter((r) => r === miembro.rol || puedeGestionar(miRol, miembro.rol, r))
  const parcial = !acceso.total && !esGestor(rol)
  async function submit(e: FormEvent) {
    e.preventDefault(); setGuardando(true); setError("")
    try {
      await api(`/api/organizaciones/${orgId}/miembros/${miembro.id}`, { method: "PATCH", body: JSON.stringify({ rol, accesoTotal: !parcial, establecimientoIds: parcial ? acceso.ids : [] }) })
      toast.success("Cambios guardados"); onListo()
    } catch (e) { setError(msg(e)) } finally { setGuardando(false) }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{miembro.nombre} {miembro.apellido}</DialogTitle><DialogDescription>Cambiá su rol y a qué campos accede. Toma efecto en su próxima acción.</DialogDescription></DialogHeader>
        <form id="miembro" onSubmit={submit} className="space-y-4">
          <RolSelector roles={roles} valor={rol} onChange={setRol} />
          {!esGestor(rol) && campos.length > 1 && <CamposSelector campos={campos} accesoTotal={acceso.total} elegidos={acceso.ids} onChange={(total, ids) => setAcceso({ total, ids })} />}
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter><Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button><Button type="submit" form="miembro" disabled={guardando}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RenombrarDialog({ orgId, nombre, onClose, onListo }: { orgId: string; nombre: string; onClose: () => void; onListo: () => void }) {
  const [valor, setValor] = useState(nombre), [guardando, setGuardando] = useState(false), [error, setError] = useState("")
  async function submit(e: FormEvent) {
    e.preventDefault(); setGuardando(true); setError("")
    try { await api(`/api/organizaciones/${orgId}`, { method: "PATCH", body: JSON.stringify({ nombre: valor }) }); toast.success("Organización renombrada"); onListo() } catch (e) { setError(msg(e)) } finally { setGuardando(false) }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Renombrar organización</DialogTitle><DialogDescription>Es el nombre del espacio que comparten todos los miembros.</DialogDescription></DialogHeader>
        <form id="renombrar" onSubmit={submit} className="space-y-3">
          <Input aria-label="Nombre de la organización" required minLength={2} maxLength={120} value={valor} onChange={(e) => setValor(e.target.value)} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form="renombrar" disabled={guardando}>Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** El enlace se muestra una sola vez (solo se guarda su hash): copiar o compartir por WhatsApp. */
function EnlaceDialog({ enlace, onClose }: { enlace: EnlaceGenerado | null; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    if (!enlace) return
    try { await navigator.clipboard.writeText(enlace.enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { toast.error("No se pudo copiar: seleccioná el enlace y copialo a mano") }
  }
  return (
    <Dialog open={!!enlace} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invitación lista</DialogTitle>
          <DialogDescription>
            {enlace?.emailEnviado ? <span className="flex items-center gap-1"><MailCheck className="h-4 w-4" />Le enviamos un correo a {enlace.email}. También podés compartir el enlace.</span> : <>Compartile este enlace a <strong>{enlace?.email}</strong>. Por seguridad solo se muestra ahora; si lo perdés, generá uno nuevo.</>}
          </DialogDescription>
        </DialogHeader>
        {enlace && (
          <div className="space-y-3">
            <Input readOnly value={enlace.enlace} aria-label="Enlace de invitación" onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={copiar}>{copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copiado ? "Copiado" : "Copiar enlace"}</Button>
              <Button variant="outline" asChild><a href={`https://wa.me/?text=${encodeURIComponent(enlace.texto)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />Enviar por WhatsApp</a></Button>
              <Button variant="ghost" asChild><a href={`mailto:${enlace.email}?subject=${encodeURIComponent("Invitación a AgroMonitor")}&body=${encodeURIComponent(enlace.texto)}`}>Abrir correo</a></Button>
            </div>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Listo</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
