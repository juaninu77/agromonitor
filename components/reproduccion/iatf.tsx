"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckCircle2, Clock, Loader2, Plus, Syringe } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PajuelaSelector } from "./pajuela-selector"
import { formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import { consumoSugerido } from "@/lib/inventario/consumo"
import { esSanitario } from "@/lib/inventario/validation"
import { ETIQUETA_VIA } from "@/lib/sanidad/validation"
import { PLANTILLAS_IATF, fechaDelPaso, plantillaIatf, tratamientosConProducto } from "@/lib/reproduccion/iatf-plantillas"

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

interface PasoLista { indice: number; dia: number; titulo: string; fecha: string; inseminacion: boolean; estado: string; vencido: boolean }
interface ProtocoloLista {
  id: string; nombre: string; plantilla: string; plantillaNombre: string; estado: "activo" | "cerrado" | "cancelado"; fechaD0: string
  torada: { id: string; nombre: string }; inseminador: string | null; hembras: number; pasos: PasoLista[]
  concepcion: { inseminadas: number; tactadas: number; prenadas: number; porcentaje: number | null } | null
}
interface ListaIatf { protocolos: ProtocoloLista[]; porInseminador: { inseminador: string; inseminadas: number; tactadas: number; prenadas: number; porcentaje: number | null }[] }

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(b.error ?? "No se pudo completar"), { codigo: b.codigo as string | undefined })
  return b.data as T
}
const post = <T,>(url: string, body: unknown) => pedir<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

const ESTADO: Record<ProtocoloLista["estado"], { texto: string; variante: "default" | "secondary" | "outline" }> = {
  activo: { texto: "En curso", variante: "default" }, cerrado: { texto: "Inseminado", variante: "secondary" }, cancelado: { texto: "Cancelado", variante: "outline" },
}

/** Pestaña IATF: protocolos del campo, su avance paso a paso y la concepción por protocolo e inseminador. */
export function IatfTab({ estId, puede }: { estId: string; puede: boolean }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["repro", "iatf", estId], queryFn: () => pedir<ListaIatf>(`/api/reproduccion/iatf?establecimientoId=${estId}`), enabled: !!estId })
  const [nuevo, setNuevo] = useState(false)
  const [paso, setPaso] = useState<{ protocolo: ProtocoloLista; paso: PasoLista } | null>(null)
  const refrescar = () => { void qc.invalidateQueries({ queryKey: ["repro"] }) }
  async function cancelar(p: ProtocoloLista) {
    if (!window.confirm(`¿Cancelar «${p.nombre}»? Sus pasos pendientes quedan cancelados; lo ya registrado no cambia.`)) return
    try { await post(`/api/reproduccion/iatf/${p.id}/cancelar`, {}); toast.success("Protocolo cancelado"); refrescar() } catch (e) { toast.error((e as Error).message) }
  }
  const protocolos = q.data?.protocolos ?? []
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Protocolos IATF</CardTitle>
            <CardDescription>Cada paso (dispositivo, hormonas, inseminación) es una tarea con fecha. Los tratamientos van a Sanidad y la inseminación registra los servicios IATF.</CardDescription>
          </div>
          {puede && <Button size="sm" onClick={() => setNuevo(true)}><Plus className="mr-2 h-4 w-4" />Nuevo protocolo IATF</Button>}
        </CardHeader>
        <CardContent className="space-y-3">
          {q.isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Cargando" /> : q.isError ? <p role="alert" className="text-sm text-destructive">{q.error.message}</p> : !protocolos.length ? (
            <p className="text-sm text-muted-foreground">Todavía no hay protocolos. Elegí una plantilla, la torada IATF y las hembras: la app arma el calendario de cada paso.</p>
          ) : protocolos.map((p) => {
            const siguiente = p.estado === "activo" ? p.pasos.find((x) => x.estado !== "completada" && x.estado !== "cancelada") : undefined
            return (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{p.nombre} <Badge variant={ESTADO[p.estado].variante} className="ml-1">{ESTADO[p.estado].texto}</Badge></p>
                    <p className="text-xs text-muted-foreground">{p.plantillaNombre} · {p.torada.nombre} · D0 {formatoDia(p.fechaD0)} · {p.hembras} hembras{p.inseminador ? ` · ${p.inseminador}` : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    {puede && siguiente && <Button size="sm" onClick={() => setPaso({ protocolo: p, paso: siguiente })}><Syringe className="mr-2 h-4 w-4" />Registrar D{siguiente.dia}</Button>}
                    {puede && p.estado === "activo" && <Button size="sm" variant="ghost" onClick={() => cancelar(p)}>Cancelar</Button>}
                  </div>
                </div>
                <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
                  {p.pasos.map((x) => (
                    <li key={x.indice} className="flex items-start gap-2">
                      {x.estado === "completada" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-label="Hecho" /> : <Clock className={`mt-0.5 h-4 w-4 shrink-0 ${x.vencido ? "text-amber-600" : "text-muted-foreground"}`} aria-label={x.vencido ? "Atrasado" : "Pendiente"} />}
                      <span><span className="font-medium">D{x.dia} · {formatoDia(x.fecha)}</span>{x.vencido && <span className="text-amber-700"> · atrasado</span>}{x.estado === "cancelada" && <span className="text-muted-foreground"> · cancelado</span>}<br /><span className="text-xs text-muted-foreground">{x.titulo}</span></span>
                    </li>
                  ))}
                </ol>
                {p.concepcion && (
                  <p className="mt-2 text-sm">Concepción: <span className="font-semibold">{p.concepcion.porcentaje != null ? `${p.concepcion.porcentaje.toLocaleString("es-AR")} %` : "sin tacto todavía"}</span>
                    <span className="text-muted-foreground"> · {p.concepcion.prenadas} preñadas de {p.concepcion.tactadas} tactadas ({p.concepcion.inseminadas} inseminadas)</span></p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
      {(q.data?.porInseminador.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Concepción por inseminador</CardTitle><CardDescription>Servicios IATF de los protocolos del campo con su tacto.</CardDescription></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="py-1 font-medium">Inseminador</th><th className="py-1 text-right font-medium">Inseminadas</th><th className="py-1 text-right font-medium">Tactadas</th><th className="py-1 text-right font-medium">% Concepción</th></tr></thead>
              <tbody>{q.data!.porInseminador.map((f) => (
                <tr key={f.inseminador} className="border-b last:border-0"><td className="py-1.5">{f.inseminador}</td><td className="py-1.5 text-right tabular-nums">{f.inseminadas}</td><td className="py-1.5 text-right tabular-nums">{f.tactadas}</td><td className="py-1.5 text-right tabular-nums">{f.porcentaje != null ? `${f.porcentaje.toLocaleString("es-AR")} %` : "—"}</td></tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      )}
      <NuevoProtocoloDialog open={nuevo} onOpenChange={setNuevo} estId={estId} onCreado={refrescar} />
      <PasoDialog datos={paso} onOpenChange={(o) => !o && setPaso(null)} onRegistrado={refrescar} />
    </div>
  )
}

interface HembraTorada { id: string; caravanaVisual: string | null; cuig: string | null; fechaNacimiento?: string | Date | null; estado: { estado: string } | null }
/** Menos de 10 meses al día 0: no entra al protocolo */
const esTernera = (h: HembraTorada, d0: string) => !!h.fechaNacimiento && /^\d{4}-\d{2}-\d{2}$/.test(d0) && String(h.fechaNacimiento).slice(0, 10) > fechaDelPaso(d0, -300)

function NuevoProtocoloDialog({ open, onOpenChange, estId, onCreado }: { open: boolean; onOpenChange: (o: boolean) => void; estId: string; onCreado: () => void }) {
  const [form, setForm] = useState({ plantilla: PLANTILLAS_IATF[0].id, toradaId: "", fechaD0: hoyArgentina(), inseminador: "", nombre: "" })
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { if (open) { setForm({ plantilla: PLANTILLAS_IATF[0].id, toradaId: "", fechaD0: hoyArgentina(), inseminador: "", nombre: "" }); setElegidas(new Set()); setError("") } }, [open])
  const toradas = useQuery({
    queryKey: ["repro", "toradas-iatf", estId],
    queryFn: async () => (await pedir<{ id: string; nombre: string; tipo: string; tipoGrupo: string; fechaFin: string | null }[]>(`/api/reproduccion/toradas?establecimientoId=${estId}&activa=true&limit=100`))
      .filter((t) => t.tipo !== "natural" && t.tipoGrupo !== "encarnerada"),
    enabled: open && !!estId,
  })
  const hembras = useQuery({
    queryKey: ["repro", "iatf-hembras", form.toradaId],
    queryFn: async () => (await pedir<{ hembras: HembraTorada[] }>(`/api/reproduccion/toradas/${form.toradaId}/hembras?fecha=${hoyArgentina()}`)).hembras,
    enabled: open && !!form.toradaId,
  })
  // Por defecto, todas las que no figuran preñadas
  useEffect(() => { if (hembras.data) setElegidas(new Set(hembras.data.filter((h) => h.estado?.estado !== "preñada" && !esTernera(h, form.fechaD0)).map((h) => h.id))) }, [hembras.data]) // eslint-disable-line react-hooks/exhaustive-deps
  const plantilla = plantillaIatf(form.plantilla)!
  async function crear(aceptarPrenadas = false) {
    if (!form.toradaId) return setError("Elegí la torada IATF")
    if (!elegidas.size) return setError("Elegí al menos una hembra")
    setEnviando(true); setError("")
    try {
      const r = await post<{ hembras: number; inseminacion: string }>("/api/reproduccion/iatf", { ...form, nombre: form.nombre || null, inseminador: form.inseminador || null, hembraIds: [...elegidas], aceptarPrenadas })
      toast.success(`Protocolo armado: ${r.hembras} hembras, inseminación el ${formatoDia(r.inseminacion)}`, { description: "Cada paso quedó como tarea con su fecha." })
      onOpenChange(false); onCreado()
    } catch (e) {
      if ((e as { codigo?: string }).codigo === "prenadas" && window.confirm((e as Error).message)) return crear(true)
      setError((e as Error).message)
    } finally { setEnviando(false) }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Nuevo protocolo IATF</DialogTitle><DialogDescription>Elegí la plantilla, la torada y el día 0: se crea una tarea por cada paso.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="iatf-plantilla">Protocolo *</Label>
            <select id="iatf-plantilla" className={selectClass} value={form.plantilla} onChange={(e) => setForm((f) => ({ ...f, plantilla: e.target.value }))}>
              {PLANTILLAS_IATF.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">{plantilla.descripcion}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iatf-torada">Torada IATF *</Label>
            <select id="iatf-torada" className={selectClass} value={form.toradaId} onChange={(e) => setForm((f) => ({ ...f, toradaId: e.target.value }))}>
              <option value="">{toradas.data && !toradas.data.length ? "No hay toradas abiertas de IATF o IA" : "Elegir"}</option>
              {(toradas.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iatf-d0">Día 0 *</Label>
            <Input id="iatf-d0" type="date" value={form.fechaD0} onChange={(e) => setForm((f) => ({ ...f, fechaD0: e.target.value }))} />
          </div>
          <div className="space-y-1.5"><Label htmlFor="iatf-insem">Inseminador</Label><Input id="iatf-insem" maxLength={120} value={form.inseminador} onChange={(e) => setForm((f) => ({ ...f, inseminador: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label htmlFor="iatf-nombre">Nombre (opcional)</Label><Input id="iatf-nombre" maxLength={120} placeholder="Se arma con el protocolo y la torada" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
        </div>
        <ol className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
          {plantilla.pasos.map((p) => (
            <li key={p.dia}><span className="font-medium">D{p.dia} · {/^\d{4}-\d{2}-\d{2}$/.test(form.fechaD0) ? formatoDia(fechaDelPaso(form.fechaD0, p.dia)) : "—"}</span>: {p.titulo}</li>
          ))}
        </ol>
        {form.toradaId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>Hembras ({elegidas.size})</Label>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => setElegidas(new Set((hembras.data ?? []).filter((h) => h.estado?.estado !== "preñada" && !esTernera(h, form.fechaD0)).map((h) => h.id)))}>Todas menos preñadas</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setElegidas(new Set())}>Ninguna</Button>
              </div>
            </div>
            {hembras.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2 text-sm sm:grid-cols-3">
                {(hembras.data ?? []).map((h) => (
                  <li key={h.id}><label className={`flex items-center gap-2 ${esTernera(h, form.fechaD0) ? "text-muted-foreground" : ""}`}>
                    <input type="checkbox" disabled={esTernera(h, form.fechaD0)} checked={elegidas.has(h.id)} onChange={(e) => setElegidas((s) => { const x = new Set(s); if (e.target.checked) x.add(h.id); else x.delete(h.id); return x })} />
                    {h.caravanaVisual ?? h.cuig ?? "Sin caravana"}{h.estado?.estado === "preñada" && <span className="text-xs text-amber-700">preñada</span>}{esTernera(h, form.fechaD0) && <span className="text-xs">ternera</span>}
                  </label></li>
                ))}
              </ul>
            )}
          </div>
        )}
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={() => crear()} disabled={enviando}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Armar protocolo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ProductoSanitario { id: string; nombre: string; tipo: string; unidad?: string; stockTotal?: number; activo?: boolean }
interface Tratamiento { productoId: string; dosis: string; descontar: string }

function PasoDialog({ datos, onOpenChange, onRegistrado }: { datos: { protocolo: ProtocoloLista; paso: PasoLista } | null; onOpenChange: (o: boolean) => void; onRegistrado: () => void }) {
  const open = !!datos
  const plantilla = datos ? plantillaIatf(datos.protocolo.plantilla) : undefined
  const pasoPlantilla = datos && plantilla ? plantilla.pasos[datos.paso.indice] : undefined
  const conProducto = useMemo(() => (pasoPlantilla ? tratamientosConProducto(pasoPlantilla) : []), [pasoPlantilla])
  const [clave, setClave] = useState("")
  const [fecha, setFecha] = useState(hoyArgentina())
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [inseminador, setInseminador] = useState("")
  const [pajuela, setPajuela] = useState({ productoId: "", loteId: "" })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const detalle = useQuery({
    queryKey: ["repro", "iatf-detalle", datos?.protocolo.id],
    queryFn: () => pedir<{ hembras: { id: string; caravanaVisual: string | null; cuig: string | null; estadoVital: string }[] }>(`/api/reproduccion/iatf/${datos!.protocolo.id}`),
    enabled: open,
  })
  const productos = useQuery({
    queryKey: ["repro", "iatf-productos"],
    queryFn: async () => (await pedir<ProductoSanitario[]>("/api/inventario?limit=500")).filter((p) => p.activo !== false && esSanitario(p.tipo))
      .sort((a, b) => Number(b.tipo === "hormona") - Number(a.tipo === "hormona") || a.nombre.localeCompare(b.nombre)),
    enabled: open && conProducto.length > 0,
  })
  useEffect(() => {
    if (!datos) return
    setClave(crypto.randomUUID()); setError("")
    setFecha(datos.paso.fecha < hoyArgentina() ? datos.paso.fecha : hoyArgentina())
    setTratamientos(conProducto.map((t) => ({ productoId: "", dosis: String(t.dosis), descontar: "" })))
    setInseminador(datos.protocolo.inseminador ?? ""); setPajuela({ productoId: "", loteId: "" })
  }, [datos, conProducto])
  useEffect(() => { if (detalle.data) setElegidas(new Set(detalle.data.hembras.filter((h) => h.estadoVital === "activo").map((h) => h.id))) }, [detalle.data])
  const setT = (i: number, p: Partial<Tratamiento>) => setTratamientos((ts) => ts.map((t, j) => (j === i ? { ...t, ...p } : t)))
  function elegirProducto(i: number, productoId: string) {
    const prod = productos.data?.find((p) => p.id === productoId)
    const ref = conProducto[i]
    const sugerido = prod ? consumoSugerido(prod.unidad ?? "", Number(tratamientos[i]?.dosis) || ref.dosis, ref.unidad, 1) : null
    setT(i, { productoId, descontar: sugerido != null ? String(sugerido) : "" })
  }
  async function registrar() {
    if (!datos || !pasoPlantilla) return
    if (!elegidas.size) return setError("Elegí al menos una hembra")
    setEnviando(true); setError("")
    try {
      const r = await post<{ hembras: number; aplicaciones: number; servicios: number; pajuelas: number }>(`/api/reproduccion/iatf/${datos.protocolo.id}/pasos/${datos.paso.indice}`, {
        clave, fecha, hembraIds: [...elegidas],
        tratamientos: tratamientos.map((t, i) => ({ t, i })).filter(({ t }) => t.productoId).map(({ t, i }) => ({
          indice: i, productoId: t.productoId, dosis: t.dosis || null, unidad: conProducto[i].unidad, via: conProducto[i].via, descontarPorAnimal: t.descontar || null,
        })),
        ...(pasoPlantilla.inseminacion ? { inseminador: inseminador || null, productoSemenId: pajuela.productoId || null, loteProductoId: pajuela.loteId || null } : {}),
      })
      toast.success(`D${datos.paso.dia} registrado: ${r.hembras} hembras`, {
        description: [r.aplicaciones ? `${r.aplicaciones} tratamientos en Sanidad` : null, r.servicios ? `${r.servicios} servicios IATF` : null, r.pajuelas ? `${r.pajuelas} pajuelas descontadas` : null].filter(Boolean).join(" · ") || undefined,
      })
      onOpenChange(false); onRegistrado()
    } catch (e) { setError((e as Error).message) } finally { setEnviando(false) }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{datos ? `D${datos.paso.dia}: ${datos.paso.titulo}` : ""}</DialogTitle>
          <DialogDescription>{datos?.protocolo.nombre}. Los tratamientos quedan en Sanidad (libro sanitario, carencia y stock){pasoPlantilla?.inseminacion ? "; la inseminación registra los servicios IATF y cierra el protocolo" : ""}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="paso-fecha">Fecha *</Label><Input id="paso-fecha" type="date" min={datos?.protocolo.fechaD0} max={hoyArgentina()} value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          {datos && datos.paso.fecha > hoyArgentina() && <p className="self-end text-xs text-amber-700">Programado para el {formatoDia(datos.paso.fecha)}: se registra con la fecha real.</p>}
        </div>
        {conProducto.map((t, i) => (
          <div key={t.nombre} className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">{t.nombre}{t.via ? <span className="font-normal text-muted-foreground"> · {ETIQUETA_VIA[t.via]}</span> : null}</p>
            {t.nota && <p className="text-xs text-muted-foreground">{t.nota}</p>}
            <div className="hidden gap-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[1fr_110px_150px]"><span>Producto del inventario</span><span>Dosis ({t.unidad})</span><span>Descontar por hembra</span></div>
            <div className="grid gap-2 sm:grid-cols-[1fr_110px_150px]">
              <select aria-label={`Producto: ${t.nombre}`} className={selectClass} value={tratamientos[i]?.productoId ?? ""} onChange={(e) => elegirProducto(i, e.target.value)}>
                <option value="">No registrar este tratamiento</option>
                {(productos.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.stockTotal != null ? ` · ${p.stockTotal.toLocaleString("es-AR")} ${p.unidad ?? ""}` : ""}</option>)}
              </select>
              <Input aria-label={`Dosis (${t.unidad})`} type="number" min="0" step="0.01" value={tratamientos[i]?.dosis ?? ""} onChange={(e) => setT(i, { dosis: e.target.value })} placeholder={`Dosis (${t.unidad})`} />
              <Input aria-label="Descontar del stock por hembra" type="number" min="0" step="0.001" value={tratamientos[i]?.descontar ?? ""} onChange={(e) => setT(i, { descontar: e.target.value })} placeholder="Stock por hembra" disabled={!tratamientos[i]?.productoId} />
            </div>
          </div>
        ))}
        {!conProducto.length && !pasoPlantilla?.inseminacion && <p className="text-sm text-muted-foreground">Este paso no lleva productos: se marca como hecho.</p>}
        {pasoPlantilla?.inseminacion && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Inseminación</p>
            <div className="space-y-1.5"><Label htmlFor="paso-insem">Inseminador</Label><Input id="paso-insem" maxLength={120} value={inseminador} onChange={(e) => setInseminador(e.target.value)} /></div>
            <PajuelaSelector id="paso-paj" enabled={open} cantidad={Math.max(1, elegidas.size)} value={pajuela} onChange={(v) => setPajuela(v)} />
          </div>
        )}
        <div className="space-y-2">
          <Label>Hembras ({elegidas.size})</Label>
          <ul className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2 text-sm sm:grid-cols-3">
            {(detalle.data?.hembras ?? []).map((h) => (
              <li key={h.id}><label className={`flex items-center gap-2 ${h.estadoVital !== "activo" ? "text-muted-foreground line-through" : ""}`}>
                <input type="checkbox" disabled={h.estadoVital !== "activo"} checked={elegidas.has(h.id)} onChange={(e) => setElegidas((s) => { const x = new Set(s); if (e.target.checked) x.add(h.id); else x.delete(h.id); return x })} />
                {h.caravanaVisual ?? h.cuig ?? "Sin caravana"}
              </label></li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Desmarcá las que no recibieron el paso (por ejemplo, si perdió el dispositivo).</p>
        </div>
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={registrar} disabled={enviando}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar D{datos?.paso.dia}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
