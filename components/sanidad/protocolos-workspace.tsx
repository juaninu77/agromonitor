"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, ClipboardList, Copy, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { useTenant } from "@/lib/context/tenant-context"
import { esSanitario, etiquetaTipo } from "@/lib/inventario/validation"
import { ESPECIES_PLAN, ETIQUETA_MOMENTO, ETIQUETA_ZONA, MOMENTOS, ZONAS_AFTOSA, textoMomento, type ItemPlan, type Momento } from "@/lib/sanidad/plan"
import { ETIQUETA_VIA, VIAS_SANIDAD } from "@/lib/sanidad/validation"

interface Protocolo {
  id: string
  nombre: string
  descripcion: string | null
  especie: string
  zonaAplicable: string | null
  plantilla: string | null
  activo: boolean
  items: (ItemPlan & { id: string; producto: { id: string; nombre: string } | null })[]
  _count: { calendarios: number }
}
interface Plantilla { codigo: string; nombre: string; descripcion: string; especie: string; zonaAplicable: string | null; items: ItemPlan[] }
interface Datos {
  campo: { id: string; nombre: string; zonaAftosa: string | null } | null
  protocolos: Protocolo[]
  plantillas: Plantilla[]
  puedeEditar: boolean
  puedeDefinirZona: boolean
}

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const TIPOS_SANITARIOS = ["vacuna", "antiparasitario", "antibiotico", "antiinflamatorio", "vitaminico", "mineral", "suplemento"]

async function enviar(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo guardar")
  return b.data
}
const mensaje = (e: unknown) => (e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se guardó")

function ItemsTabla({ items }: { items: (ItemPlan & { producto?: { nombre: string } | null })[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Sin ítems todavía.</p>
  return (
    <ul className="divide-y text-sm">
      {items.map((i, n) => (
        <li key={i.id ?? n} className="flex flex-wrap items-start justify-between gap-2 py-2">
          <span className="min-w-0">
            <strong>{i.nombre}</strong>
            {i.esAftosa && <Badge variant="outline" className="ml-2">Aftosa</Badge>}
            {!i.obligatorio && <Badge variant="outline" className="ml-2">Opcional</Badge>}
            <span className="block text-xs text-muted-foreground">
              {[i.destinatarios, i.producto?.nombre ?? (i.productoTipo ? etiquetaTipo(i.productoTipo) : null), i.dosis ? `${i.dosis} ${i.unidad ?? ""}`.trim() : null].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">{textoMomento(i)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Protocolos sanitarios de la organización, plantillas de la spec y zona de aftosa del campo. */
export function ProtocolosWorkspace() {
  const { establecimientoActivo } = useTenant()
  const estId = establecimientoActivo?.id ?? ""
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ["sanidad", "protocolos", estId],
    queryFn: async () => { const r = await fetch(`/api/sanidad/protocolos?establecimientoId=${estId}`); const b = await r.json(); if (!r.ok) throw new Error(b.error ?? "No se pudo cargar"); return b.data as Datos },
    enabled: !!estId,
  })
  const [editando, setEditando] = useState<Protocolo | null>(null)
  const [creandoVacio, setCreandoVacio] = useState(false)
  const [ocupado, setOcupado] = useState("")
  // Zona elegida (se muestra al instante, sin esperar a que se recargue el campo)
  const [zona, setZona] = useState<string | null>(null)
  useEffect(() => { setZona(q.data?.campo?.zonaAftosa ?? "") }, [q.data?.campo?.zonaAftosa])
  const recargar = () => qc.invalidateQueries({ queryKey: ["sanidad", "protocolos"] })

  async function usarPlantilla(codigo: string) {
    setOcupado(codigo)
    try {
      const p = await enviar("/api/sanidad/protocolos", "POST", { establecimientoId: estId, plantilla: codigo })
      toast.success(`Protocolo «${p.nombre}» creado: ajustalo con tu veterinario`)
      await recargar()
    } catch (e) { toast.error(mensaje(e)) } finally { setOcupado("") }
  }
  async function guardarZona(nueva: string) {
    const anterior = zona
    setZona(nueva)
    try {
      await enviar("/api/sanidad/zona", "PATCH", { establecimientoId: estId, zonaAftosa: nueva || null })
      toast.success("Zona de aftosa guardada"); await recargar()
    } catch (e) { setZona(anterior); toast.error(mensaje(e)) }
  }
  async function cambiarActivo(p: Protocolo) {
    try { await enviar(`/api/sanidad/protocolos/${p.id}`, "PATCH", { activo: !p.activo }); toast.success(p.activo ? "Protocolo archivado" : "Protocolo reactivado"); await recargar() } catch (e) { toast.error(mensaje(e)) }
  }

  if (!estId) return <p>Seleccioná un campo.</p>
  if (q.isPending) return <p role="status"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando protocolos…</p>
  if (q.isError) return <p role="alert" className="erp-error">{q.error.message} <button className="underline" onClick={() => q.refetch()}>Reintentar</button></p>
  const d = q.data

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/sanidad"><ArrowLeft className="h-4 w-4" />Sanidad</Link></Button>
      <PageHeading title="Plan sanitario" icon={ClipboardList} context={d.campo?.nombre}
        description="Protocolos de la organización: qué se aplica, a quiénes y cuándo. Partí de una plantilla y ajustala con tu veterinario."
        actions={d.puedeEditar && <Button variant="outline" onClick={() => setCreandoVacio(true)}><Plus className="h-4 w-4" />Protocolo vacío</Button>} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Zona de aftosa del campo</CardTitle>
          <CardDescription>En zona libre sin vacunación (Patagonia al sur del paralelo 42) no se programan campañas de aftosa.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {d.puedeDefinirZona ? (
            <select aria-label="Zona de aftosa" className={`${selectClass} max-w-xs`} value={zona ?? ""} onChange={(e) => guardarZona(e.target.value)}>
              <option value="">Sin definir</option>
              {ZONAS_AFTOSA.map((z) => <option key={z} value={z}>{ETIQUETA_ZONA[z]}</option>)}
            </select>
          ) : <span className="text-sm">{d.campo?.zonaAftosa ? ETIQUETA_ZONA[d.campo.zonaAftosa as keyof typeof ETIQUETA_ZONA] : "Sin definir"}</span>}
          {!zona && <span className="text-sm text-amber-700">Definila antes de armar un calendario con aftosa.</span>}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Protocolos de la organización</h2>
        {!d.protocolos.length ? <p className="text-sm text-muted-foreground">Todavía no hay protocolos. Usá una plantilla de abajo para empezar.</p> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {d.protocolos.map((p) => (
              <Card key={p.id} className={p.activo ? undefined : "opacity-70"}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{p.nombre}{!p.activo && <Badge variant="outline" className="ml-2">Archivado</Badge>}</CardTitle>
                      <CardDescription className="capitalize">{p.especie}{p.zonaAplicable ? ` · ${ETIQUETA_ZONA[p.zonaAplicable as keyof typeof ETIQUETA_ZONA]}` : ""} · {p.items.length} ítems{p._count.calendarios ? ` · ${p._count.calendarios} calendarios` : ""}</CardDescription>
                    </div>
                    {d.puedeEditar && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditando(p)}><Pencil className="h-4 w-4" />Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => cambiarActivo(p)}>{p.activo ? "Archivar" : "Reactivar"}</Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent><ItemsTabla items={p.items} /></CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Plantillas</h2>
        <p className="text-sm text-muted-foreground">Basadas en el plan sanitario argentino (spec 02). Al usarlas se copian a tu organización para que las ajustes: productos, dosis y fechas dependen de cada campo y de su veterinario.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.plantillas.map((t) => (
            <Card key={t.codigo}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t.nombre}</CardTitle><CardDescription>{t.descripcion}</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs capitalize text-muted-foreground">{t.especie} · {t.items.length} ítems{t.zonaAplicable ? ` · ${ETIQUETA_ZONA[t.zonaAplicable as keyof typeof ETIQUETA_ZONA]}` : ""}</p>
                <details><summary className="cursor-pointer text-sm">Ver ítems</summary><div className="mt-2"><ItemsTabla items={t.items} /></div></details>
                {d.puedeEditar && <Button size="sm" variant="outline" disabled={!!ocupado} onClick={() => usarPlantilla(t.codigo)}>{ocupado === t.codigo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}Usar plantilla</Button>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <EditarProtocoloDialog protocolo={editando} estId={estId} onOpenChange={(o) => !o && setEditando(null)} onGuardado={recargar} />
      <NuevoProtocoloDialog abierto={creandoVacio} estId={estId} onOpenChange={setCreandoVacio} onCreado={(p) => { void recargar(); setEditando(p) }} />
    </div>
  )
}

function NuevoProtocoloDialog({ abierto, estId, onOpenChange, onCreado }: { abierto: boolean; estId: string; onOpenChange: (o: boolean) => void; onCreado: (p: Protocolo) => void }) {
  const [nombre, setNombre] = useState(""), [especie, setEspecie] = useState("bovino"), [guardando, setGuardando] = useState(false)
  useEffect(() => { if (abierto) { setNombre(""); setEspecie("bovino") } }, [abierto])
  async function crear() {
    setGuardando(true)
    try { const p = await enviar("/api/sanidad/protocolos", "POST", { establecimientoId: estId, nombre, especie }); onOpenChange(false); onCreado({ ...p, items: [], _count: { calendarios: 0 } }) } catch (e) { toast.error(mensaje(e)) } finally { setGuardando(false) }
  }
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Protocolo vacío</DialogTitle><DialogDescription>Después agregás los ítems.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="np-nombre">Nombre</Label><Input id="np-nombre" maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="np-especie">Especie</Label>
            <select id="np-especie" className={selectClass} value={especie} onChange={(e) => setEspecie(e.target.value)}>{ESPECIES_PLAN.map((e) => <option key={e} value={e} className="capitalize">{e}</option>)}</select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={guardando || nombre.trim().length < 3} onClick={crear}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Campo de un ítem con su etiqueta corta visible. */
function Campo({ etiqueta, children, className }: { etiqueta: string; children: ReactNode; className?: string }) {
  return <label className={`space-y-1 text-xs text-muted-foreground ${className ?? ""}`}><span>{etiqueta}</span>{children}</label>
}

type ItemForm = Omit<ItemPlan, "mes" | "dia" | "diasOffset" | "repetirCadaDias" | "dosis"> & { mes: string; dia: string; diasOffset: string; repetirCadaDias: string; dosis: string }
const aForm = (i: ItemPlan): ItemForm => ({ ...i, mes: i.mes?.toString() ?? "", dia: i.dia?.toString() ?? "", diasOffset: String(i.diasOffset ?? 0), repetirCadaDias: i.repetirCadaDias?.toString() ?? "", dosis: i.dosis?.toString() ?? "" })
const itemVacio = (): ItemForm => aForm({ nombre: "", momento: "campania_otono", mes: null, dia: null, diasOffset: 0, repetirCadaDias: null, destinatarios: null, productoTipo: "vacuna", productoId: null, dosis: null, unidad: null, via: null, esAftosa: false, obligatorio: true, notas: null })

function EditarProtocoloDialog({ protocolo, estId, onOpenChange, onGuardado }: { protocolo: Protocolo | null; estId: string; onOpenChange: (o: boolean) => void; onGuardado: () => void }) {
  const { organizacionActiva } = useTenant()
  const [datos, setDatos] = useState({ nombre: "", descripcion: "", especie: "bovino", zonaAplicable: "" })
  const [items, setItems] = useState<ItemForm[]>([])
  const [guardando, setGuardando] = useState(false), [error, setError] = useState("")
  const productosQ = useQuery({
    queryKey: ["inventario", "sanitarios", "protocolos"],
    queryFn: async () => { const r = await fetch("/api/inventario?limit=500"); const b = await r.json(); return (b.data ?? []) as { id: string; nombre: string; tipo: string; activo: boolean; organizacionId: string | null; unidad: string }[] },
    enabled: !!protocolo, staleTime: 60_000,
  })
  const productos = useMemo(() => (productosQ.data ?? []).filter((p) => esSanitario(p.tipo) && p.activo && (!organizacionActiva || p.organizacionId === organizacionActiva.id)), [productosQ.data, organizacionActiva])
  useEffect(() => {
    if (!protocolo) return
    setError("")
    setDatos({ nombre: protocolo.nombre, descripcion: protocolo.descripcion ?? "", especie: protocolo.especie, zonaAplicable: protocolo.zonaAplicable ?? "" })
    setItems(protocolo.items.map(aForm))
  }, [protocolo])
  const setItem = (n: number, cambio: Partial<ItemForm>) => setItems(items.map((i, k) => (k === n ? { ...i, ...cambio } : i)))

  async function guardar() {
    if (!protocolo) return
    setGuardando(true); setError("")
    try {
      await enviar(`/api/sanidad/protocolos/${protocolo.id}`, "PATCH", {
        nombre: datos.nombre, descripcion: datos.descripcion || null, especie: datos.especie, zonaAplicable: datos.zonaAplicable || null,
        items: items.map((i) => ({ ...i, id: i.id || undefined })),
      })
      toast.success("Protocolo guardado"); onOpenChange(false); onGuardado()
    } catch (e) { setError(mensaje(e)); toast.error(mensaje(e)) } finally { setGuardando(false) }
  }

  return (
    <Dialog open={!!protocolo} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Editar protocolo</DialogTitle><DialogDescription>Los cambios valen para los calendarios que se armen desde ahora.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="ep-nombre">Nombre</Label><Input id="ep-nombre" maxLength={120} value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="ep-desc">Descripción</Label><Input id="ep-desc" maxLength={500} value={datos.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ep-especie">Especie</Label>
            <select id="ep-especie" className={selectClass} value={datos.especie} onChange={(e) => setDatos({ ...datos, especie: e.target.value })}>{ESPECIES_PLAN.map((e) => <option key={e} value={e}>{e}</option>)}</select></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ep-zona">Pensado para zona</Label>
            <select id="ep-zona" className={selectClass} value={datos.zonaAplicable} onChange={(e) => setDatos({ ...datos, zonaAplicable: e.target.value })}><option value="">Cualquier zona</option>{ZONAS_AFTOSA.map((z) => <option key={z} value={z}>{ETIQUETA_ZONA[z]}</option>)}</select></div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-medium">Ítems ({items.length})</h3><Button size="sm" variant="outline" onClick={() => setItems([...items, itemVacio()])}><Plus className="h-4 w-4" />Agregar ítem</Button></div>
          {items.map((i, n) => (
            <fieldset key={i.id ?? `nuevo-${n}`} className="space-y-2 rounded-md border p-3">
              <legend className="sr-only">Ítem {n + 1}</legend>
              <div className="flex gap-2">
                <Input aria-label={`Nombre del ítem ${n + 1}`} placeholder="Ej.: Brucelosis B19" maxLength={160} value={i.nombre} onChange={(e) => setItem(n, { nombre: e.target.value })} />
                <Button size="icon" variant="ghost" aria-label={`Quitar ítem ${n + 1}`} onClick={() => setItems(items.filter((_, k) => k !== n))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <Campo etiqueta="Cuándo"><select aria-label="Momento" className={selectClass} value={i.momento} onChange={(e) => setItem(n, { momento: e.target.value as Momento })}>{MOMENTOS.map((m) => <option key={m} value={m}>{ETIQUETA_MOMENTO[m]}</option>)}</select></Campo>
                {i.momento === "fecha" ? (
                  <Campo etiqueta="Día y mes"><div className="flex gap-2"><Input aria-label="Día" type="number" min={1} max={31} placeholder="Día" value={i.dia} onChange={(e) => setItem(n, { dia: e.target.value })} /><Input aria-label="Mes" type="number" min={1} max={12} placeholder="Mes" value={i.mes} onChange={(e) => setItem(n, { mes: e.target.value })} /></div></Campo>
                ) : <Campo etiqueta="± días (antes/después)"><Input aria-label="Días antes (−) o después (+)" type="number" min={-365} max={365} value={i.diasOffset} onChange={(e) => setItem(n, { diasOffset: e.target.value })} /></Campo>}
                <Campo etiqueta="Repetir cada (días)"><Input aria-label="Repetir cada (días)" type="number" min={1} max={365} placeholder="No se repite" value={i.repetirCadaDias} onChange={(e) => setItem(n, { repetirCadaDias: e.target.value })} /></Campo>
                <Campo etiqueta="A quiénes"><Input aria-label="A quiénes" placeholder="Ej.: terneras 3–8 meses" maxLength={200} value={i.destinatarios ?? ""} onChange={(e) => setItem(n, { destinatarios: e.target.value })} /></Campo>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <Campo etiqueta="Producto" className="sm:col-span-2"><select aria-label="Producto" className={selectClass} value={i.productoId ?? ""} onChange={(e) => setItem(n, { productoId: e.target.value || null })}>
                  <option value="">{i.productoTipo ? `Cualquier ${etiquetaTipo(i.productoTipo).toLowerCase()}` : "Sin producto"}</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select></Campo>
                <Campo etiqueta="Tipo"><select aria-label="Tipo de producto" className={selectClass} value={i.productoTipo ?? ""} onChange={(e) => setItem(n, { productoTipo: e.target.value || null })}><option value="">Sin tipo</option>{TIPOS_SANITARIOS.map((t) => <option key={t} value={t}>{etiquetaTipo(t)}</option>)}</select></Campo>
                <Campo etiqueta="Vía"><select aria-label="Vía" className={selectClass} value={i.via ?? ""} onChange={(e) => setItem(n, { via: e.target.value || null })}><option value="">—</option>{VIAS_SANIDAD.map((v) => <option key={v} value={v}>{ETIQUETA_VIA[v]}</option>)}</select></Campo>
              </div>
              <div className="grid items-end gap-2 sm:grid-cols-4">
                <Campo etiqueta="Dosis"><Input aria-label="Dosis" type="number" min={0} step="0.1" placeholder="Opcional" value={i.dosis} onChange={(e) => setItem(n, { dosis: e.target.value })} /></Campo>
                <Campo etiqueta="Unidad"><Input aria-label="Unidad" placeholder="ml" maxLength={20} value={i.unidad ?? ""} onChange={(e) => setItem(n, { unidad: e.target.value })} /></Campo>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={i.obligatorio} onChange={(e) => setItem(n, { obligatorio: e.target.checked })} />Obligatorio</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={i.esAftosa} onChange={(e) => setItem(n, { esAftosa: e.target.checked })} />Es aftosa</label>
              </div>
              <Input aria-label="Notas" placeholder="Notas" maxLength={500} value={i.notas ?? ""} onChange={(e) => setItem(n, { notas: e.target.value })} />
            </fieldset>
          ))}
        </div>
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button><Button onClick={guardar} disabled={guardando}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar protocolo</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
