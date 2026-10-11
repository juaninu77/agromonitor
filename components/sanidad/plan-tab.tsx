"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { AlertTriangle, CalendarPlus, CheckCircle2, ClipboardList, Loader2, Syringe } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import type { ItemPlan } from "@/lib/sanidad/plan"
import { ETIQUETA_ANCLA, anclasNecesarias, type Anclas } from "@/lib/sanidad/proyeccion"

export interface TareaPlan {
  id: string
  titulo: string
  descripcion: string | null
  estado: string
  fecha: string | null
  vencida: boolean
  item: { productoId: string | null; productoTipo: string | null; dosis: number | null; unidad: string | null; via: string | null; destinatarios: string | null; producto: { nombre: string } | null } | null
  calendario: { id: string; nombre: string; loteId: string | null; lote: { nombre: string } | null; protocolo: { especie: string } } | null
}
interface Indicadores {
  anio: number
  cobertura: { debidas: number; cumplidas: number; porcentaje: number | null }
  tareasVencidas: number
  costo: { totalAnio: number; porAnimal: number | null; animalesActivos: number; porCategoria: { categoria: string; total: number; animales: number; porAnimal: number | null }[] }
  curativosPorMes: { mes: string; casos: number }[]
  alertaBrote: { casos: number; promedioPrevio: number } | null
  animalesBajoRetiro: number
}
interface Calendario {
  id: string; nombre: string; anio: number; activo: boolean; fechaInicio: string
  protocolo: { nombre: string; especie: string }; lote: { nombre: string } | null
  avance: { completadas: number; pendientes: number; canceladas: number; vencidas: number }
}
interface ProtocoloOpcion { id: string; nombre: string; especie: string; activo: boolean; items: ItemPlan[] }

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const etiquetaMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`
const graficoConfig = { casos: { label: "Casos curativos", color: "hsl(var(--chart-1))" } } satisfies ChartConfig

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo cargar")
  return b.data as T
}

/**
 * Plan sanitario del campo: indicadores (spec 02 §2.10), calendarios activos, próximas
 * tareas para registrar y casos curativos por mes.
 */
export function PlanTab({ estId, lotes, puedeGestionar, tareaInicial, onRegistrar }: {
  estId: string
  lotes: { id: string; nombre: string }[]
  puedeGestionar: boolean
  /** Tarea a abrir al entrar (enlace desde Tareas: /sanidad?tarea=…) */
  tareaInicial?: string | null
  onRegistrar: (t: TareaPlan) => void
}) {
  const qc = useQueryClient()
  const [nuevo, setNuevo] = useState(false)
  const ind = useQuery({ queryKey: ["sanidad", "indicadores", estId], queryFn: () => getJson<Indicadores>(`/api/sanidad/indicadores?establecimientoId=${estId}`), enabled: !!estId, staleTime: 60_000 })
  const cal = useQuery({ queryKey: ["sanidad", "calendarios", estId], queryFn: () => getJson<Calendario[]>(`/api/sanidad/calendarios?establecimientoId=${estId}`), enabled: !!estId })
  const tareas = useQuery({ queryKey: ["sanidad", "plan", estId], queryFn: () => getJson<TareaPlan[]>(`/api/sanidad/plan?establecimientoId=${estId}&estado=pendientes&limite=100`), enabled: !!estId })

  // Enlace directo a una tarea: se abre el registro una sola vez
  const [abierta, setAbierta] = useState<string | null>(null)
  useEffect(() => {
    if (!tareaInicial || abierta === tareaInicial || !tareas.data) return
    const t = tareas.data.find((x) => x.id === tareaInicial)
    setAbierta(tareaInicial)
    if (!t) toast.info("Esa tarea del plan ya no está pendiente")
    else if (!puedeGestionar) toast.info("Solo un administrador, encargado o veterinario puede registrar tratamientos")
    else onRegistrar(t)
  }, [tareaInicial, tareas.data, abierta, onRegistrar, puedeGestionar])

  async function desactivar(c: Calendario) {
    if (!window.confirm(`¿Desactivar «${c.nombre}»? Sus ${c.avance.pendientes} tareas pendientes quedan canceladas; lo ya registrado no cambia.`)) return
    try {
      const r = await fetch(`/api/sanidad/calendarios/${c.id}`, { method: "DELETE" })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? "No se pudo desactivar")
      toast.success(`Calendario desactivado · ${b.data.canceladas} tareas canceladas`)
      void qc.invalidateQueries({ queryKey: ["sanidad"] })
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo desactivar") }
  }

  const i = ind.data
  const activos = (cal.data ?? []).filter((c) => c.activo)
  const inactivos = (cal.data ?? []).filter((c) => !c.activo)

  return (
    <div className="space-y-6">
      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardHeader className="pb-1"><CardDescription>Cobertura del plan ({i?.anio ?? "…"})</CardDescription>
          <CardTitle className="text-2xl">{i ? (i.cobertura.porcentaje != null ? `${i.cobertura.porcentaje} %` : "—") : "…"}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{i?.cobertura.debidas ? `${i.cobertura.cumplidas} de ${i.cobertura.debidas} tareas obligatorias a la fecha` : "Sin tareas obligatorias vencidas todavía"}</CardContent></Card>
        <Card className={i?.tareasVencidas ? "border-amber-300" : undefined}><CardHeader className="pb-1"><CardDescription>Tareas vencidas</CardDescription>
          <CardTitle className={`text-2xl ${i?.tareasVencidas ? "text-amber-700" : ""}`}>{i?.tareasVencidas ?? "…"}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">Del calendario sanitario, sin registrar</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardDescription>Costo sanitario por animal ({i?.anio ?? "…"})</CardDescription>
          <CardTitle className="text-2xl">{i?.costo.porAnimal != null ? pesos(i.costo.porAnimal) : "—"}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{i ? `${pesos(i.costo.totalAnio)} en el año · ${i.costo.animalesActivos} animales activos` : ""}</CardContent></Card>
        <Card className={i?.alertaBrote ? "border-red-300" : undefined}><CardHeader className="pb-1"><CardDescription>Casos curativos</CardDescription>
          <CardTitle className={`flex items-center gap-2 text-2xl ${i?.alertaBrote ? "text-red-700" : ""}`}>
            {i?.alertaBrote ? <AlertTriangle className="h-5 w-5" aria-hidden /> : null}{i ? i.curativosPorMes.at(-1)?.casos ?? 0 : "…"}<span className="text-sm font-normal text-muted-foreground">este mes</span></CardTitle></CardHeader>
          <CardContent className="text-xs">{i?.alertaBrote ? <span className="text-red-700">Posible brote: más del doble del promedio de los 3 meses anteriores ({i.alertaBrote.promedioPrevio})</span> : <span className="text-muted-foreground">Sin alerta de brote</span>}</CardContent></Card>
      </div>

      {/* Calendarios */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div><CardTitle className="text-base">Calendarios sanitarios</CardTitle><CardDescription>Un protocolo aplicado al campo (o a un grupo) genera las tareas del año.</CardDescription></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link href="/sanidad/protocolos"><ClipboardList className="h-4 w-4" />Protocolos</Link></Button>
            {puedeGestionar && <Button size="sm" onClick={() => setNuevo(true)}><CalendarPlus className="h-4 w-4" />Nuevo calendario</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {cal.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : !activos.length ? (
            <p className="text-sm text-muted-foreground">No hay calendarios activos. {puedeGestionar ? "Creá uno a partir de un protocolo." : ""}</p>
          ) : (
            <ul className="divide-y text-sm">
              {activos.map((c) => {
                const total = c.avance.completadas + c.avance.pendientes
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0"><strong>{c.nombre}</strong>
                      <span className="block text-xs text-muted-foreground">{c.protocolo.especie}{c.lote ? ` · grupo ${c.lote.nombre}` : " · todo el campo"} · desde {formatoDia(c.fechaInicio)}</span></span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs tabular-nums">{c.avance.completadas}/{total} hechas</span>
                      {c.avance.vencidas > 0 && <Badge variant="outline" className="border-amber-300 text-amber-800">{c.avance.vencidas} vencidas</Badge>}
                      {puedeGestionar && <Button size="sm" variant="ghost" onClick={() => desactivar(c)}>Desactivar</Button>}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {inactivos.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{inactivos.length} calendarios desactivados.</p>}
        </CardContent>
      </Card>

      {/* Próximas tareas */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tareas pendientes del plan</CardTitle><CardDescription>Al registrar la aplicación, la tarea queda cumplida y vinculada al tratamiento.</CardDescription></CardHeader>
        <CardContent>
          {tareas.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : !tareas.data?.length ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" />No hay tareas pendientes.</p>
          ) : (
            <ul className="divide-y text-sm">
              {tareas.data.slice(0, 30).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className={`mr-2 tabular-nums ${t.vencida ? "font-medium text-amber-800" : "text-muted-foreground"}`}>{t.fecha ? formatoDia(t.fecha) : "—"}</span>
                    <strong>{t.titulo}</strong>{t.vencida && <Badge variant="outline" className="ml-2 border-amber-300 text-amber-800">Vencida</Badge>}
                    <span className="block text-xs text-muted-foreground">{[t.calendario?.lote ? `Grupo ${t.calendario.lote.nombre}` : "Todo el campo", t.item?.destinatarios, t.item?.producto?.nombre].filter(Boolean).join(" · ")}</span>
                  </span>
                  {puedeGestionar && <Button size="sm" variant="outline" onClick={() => onRegistrar(t)}><Syringe className="h-4 w-4" />Registrar</Button>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Casos curativos por mes</CardTitle><CardDescription>Últimos 12 meses (tratamientos con motivo curativo)</CardDescription></CardHeader>
          <CardContent>
            {i ? (
              <>
                <ChartContainer config={graficoConfig} className="h-56 w-full">
                  <BarChart data={i.curativosPorMes.map((m) => ({ ...m, etiqueta: etiquetaMes(m.mes) }))} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid vertical={false} strokeOpacity={0.4} />
                    <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={40} />
                    <ChartTooltip cursor={{ fillOpacity: 0.08 }} content={<ChartTooltipContent />} />
                    <Bar dataKey="casos" fill="var(--color-casos)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ChartContainer>
                <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted-foreground">Ver como tabla</summary>
                  <table className="mt-1 w-full"><tbody>{i.curativosPorMes.map((m) => <tr key={m.mes}><td>{etiquetaMes(m.mes)}</td><td className="text-right tabular-nums">{m.casos}</td></tr>)}</tbody></table>
                </details>
              </>
            ) : <Loader2 className="h-5 w-5 animate-spin" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Costo sanitario por categoría ({i?.anio ?? "…"})</CardTitle><CardDescription>Tratamientos individuales con costo (los aplicados a un grupo no se reparten por categoría)</CardDescription></CardHeader>
          <CardContent>
            {!i ? <Loader2 className="h-5 w-5 animate-spin" /> : !i.costo.porCategoria.length ? <p className="text-sm text-muted-foreground">Sin tratamientos con costo este año.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-1 font-normal">Categoría</th><th className="text-right font-normal">Animales</th><th className="text-right font-normal">Total</th><th className="text-right font-normal">Por animal</th></tr></thead>
                <tbody>{i.costo.porCategoria.map((c) => <tr key={c.categoria} className="border-b last:border-0"><td className="py-1 capitalize">{c.categoria}</td><td className="text-right tabular-nums">{c.animales}</td><td className="text-right tabular-nums">{pesos(c.total)}</td><td className="text-right tabular-nums">{c.porAnimal != null ? pesos(c.porAnimal) : "—"}</td></tr>)}</tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <NuevoCalendarioDialog abierto={nuevo} onOpenChange={setNuevo} estId={estId} lotes={lotes} onCreado={() => qc.invalidateQueries({ queryKey: ["sanidad"] })} />
    </div>
  )
}

function NuevoCalendarioDialog({ abierto, onOpenChange, estId, lotes, onCreado }: { abierto: boolean; onOpenChange: (o: boolean) => void; estId: string; lotes: { id: string; nombre: string }[]; onCreado: () => void }) {
  const hoy = hoyArgentina()
  const vacio = { protocoloId: "", anio: hoy.slice(0, 4), loteId: "", fechaInicio: hoy, fechaCampaniaOtono: "", fechaCampaniaPrimavera: "", fechaPreServicio: "", fechaDestete: "", fechaPreEsquila: "" }
  const [form, setForm] = useState(vacio)
  const [previa, setPrevia] = useState<{ programadas: { nombre: string; fecha: string; obligatorio: boolean }[]; omitidos: { nombre: string; motivo: string }[] } | null>(null)
  const [error, setError] = useState(""), [cargando, setCargando] = useState(false), [guardando, setGuardando] = useState(false)
  const prot = useQuery({
    queryKey: ["sanidad", "protocolos", estId],
    queryFn: async () => { const r = await fetch(`/api/sanidad/protocolos?establecimientoId=${estId}`); const b = await r.json(); if (!r.ok) throw new Error(b.error); return b.data as { protocolos: ProtocoloOpcion[]; campo: { zonaAftosa: string | null } | null } },
    enabled: abierto && !!estId,
  })
  useEffect(() => { if (abierto) { setForm(vacio); setPrevia(null); setError(""); setPrecargadas({}) } }, [abierto]) // eslint-disable-line react-hooks/exhaustive-deps
  const protocolo = prot.data?.protocolos.find((p) => p.id === form.protocoloId)
  const anclas = useMemo(() => (protocolo ? anclasNecesarias(protocolo.items) : []), [protocolo])
  // Fechas que salen de Reproducción: inicio del servicio de la torada y destete del primer parto
  const usaReproduccion = anclas.includes("fechaPreServicio") || anclas.includes("fechaDestete")
  const sugeridas = useQuery({
    queryKey: ["repro", "anclas", estId, form.anio, form.loteId, protocolo?.especie],
    queryFn: async () => {
      const r = await fetch(`/api/reproduccion/anclas?establecimientoId=${estId}&anio=${form.anio}${form.loteId ? `&loteId=${form.loteId}` : ""}${protocolo ? `&especie=${protocolo.especie}` : ""}`)
      const b = await r.json().catch(() => ({}))
      return (r.ok ? b.data : null) as { fechaPreServicio: string | null; origenPreServicio: string | null; fechaDestete: string | null; origenDestete: string | null } | null
    },
    enabled: abierto && usaReproduccion && /^\d{4}$/.test(form.anio),
  })
  const [precargadas, setPrecargadas] = useState<Record<string, string>>({})
  useEffect(() => {
    const s = sugeridas.data
    if (!s) return
    const cambios: Record<string, string> = {}, origen: Record<string, string> = {}
    if (anclas.includes("fechaPreServicio") && !form.fechaPreServicio && s.fechaPreServicio) { cambios.fechaPreServicio = s.fechaPreServicio; origen.fechaPreServicio = s.origenPreServicio ?? "" }
    if (anclas.includes("fechaDestete") && !form.fechaDestete && s.fechaDestete) { cambios.fechaDestete = s.fechaDestete; origen.fechaDestete = s.origenDestete ?? "" }
    if (Object.keys(cambios).length) { setForm((f) => ({ ...f, ...cambios })); setPrecargadas((p) => ({ ...p, ...origen })) }
  }, [sugeridas.data, anclas]) // eslint-disable-line react-hooks/exhaustive-deps
  const cuerpo = () => ({ ...form, establecimientoId: estId, anio: Number(form.anio), loteId: form.loteId || null })

  // Vista previa automática al cambiar el formulario
  useEffect(() => {
    if (!abierto || !form.protocoloId) { setPrevia(null); return }
    const t = setTimeout(async () => {
      setCargando(true); setError("")
      try {
        const r = await fetch("/api/sanidad/calendarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cuerpo(), vistaPrevia: true }) })
        const b = await r.json().catch(() => ({}))
        if (!r.ok) { setPrevia(null); setError(b.error ?? "No se pudo calcular") } else setPrevia(b.data)
      } finally { setCargando(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [form, abierto]) // eslint-disable-line react-hooks/exhaustive-deps

  async function crear() {
    setGuardando(true); setError("")
    try {
      const r = await fetch("/api/sanidad/calendarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo()) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? "No se pudo crear")
      toast.success(`Calendario creado: ${b.data.tareas} tareas en Tareas`)
      onOpenChange(false); onCreado()
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear") } finally { setGuardando(false) }
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Nuevo calendario sanitario</DialogTitle><DialogDescription>Elegí el protocolo y las fechas del año: se crean las tareas sanitarias con su fecha.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="nc-prot">Protocolo</Label>
            <select id="nc-prot" className={selectClass} value={form.protocoloId} onChange={(e) => setForm({ ...form, protocoloId: e.target.value })}>
              <option value="">Elegir protocolo</option>
              {(prot.data?.protocolos ?? []).filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.especie})</option>)}
            </select>
            {prot.data && !prot.data.protocolos.some((p) => p.activo) && <p className="text-xs text-muted-foreground">No hay protocolos: <Link className="underline" href="/sanidad/protocolos">creá uno desde una plantilla</Link>.</p>}
          </div>
          <div className="space-y-1.5"><Label htmlFor="nc-anio">Año</Label><Input id="nc-anio" type="number" min={2000} max={2100} value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="nc-grupo">Grupo (opcional)</Label>
            <select id="nc-grupo" className={selectClass} value={form.loteId} onChange={(e) => setForm({ ...form, loteId: e.target.value })}><option value="">Todo el campo</option>{lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="nc-inicio">Inicio del calendario</Label><Input id="nc-inicio" type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} /></div>
          {anclas.map((a) => (
            <div key={a} className="space-y-1.5"><Label htmlFor={`nc-${a}`}>{ETIQUETA_ANCLA[a]}</Label>
              <Input id={`nc-${a}`} type="date" value={form[a as keyof typeof form]} onChange={(e) => { setForm({ ...form, [a]: e.target.value }); setPrecargadas((p) => { const x = { ...p }; delete x[a]; return x }) }} />
              {precargadas[a] && <p className="text-xs text-muted-foreground">Sugerida por Reproducción: {precargadas[a]}</p>}</div>
          ))}
        </div>
        {prot.data?.campo && !prot.data.campo.zonaAftosa && protocolo?.items.some((i) => i.esAftosa) && <p className="erp-notice text-sm">El protocolo incluye aftosa y el campo no tiene zona definida: <Link className="underline" href="/sanidad/protocolos">definila en Plan sanitario</Link>.</p>}
        {cargando && <p role="status" className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Calculando tareas…</p>}
        {previa && (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p className="font-medium">{previa.programadas.length} tareas a crear</p>
            <ul className="max-h-48 space-y-0.5 overflow-y-auto">{previa.programadas.map((p, k) => <li key={k}><span className="tabular-nums text-muted-foreground">{formatoDia(p.fecha)}</span> · {p.nombre}{!p.obligatorio && <span className="text-muted-foreground"> (opcional)</span>}</li>)}</ul>
            {previa.omitidos.length > 0 && (
              <div><p className="font-medium">No se programan ({previa.omitidos.length})</p>
                <ul className="text-muted-foreground">{previa.omitidos.map((o, k) => <li key={k}>{o.nombre}: {o.motivo}</li>)}</ul></div>
            )}
          </div>
        )}
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
          <Button onClick={crear} disabled={guardando || !previa?.programadas.length}>{guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear calendario ({previa?.programadas.length ?? 0} tareas)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
