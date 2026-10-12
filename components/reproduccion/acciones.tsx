"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AnimalCombobox, etiquetaAnimal, type AnimalOpcion } from "./animal-combobox"
import { formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import { ETIQUETA_METODO_DESTETE, ETIQUETA_TIPO_PARTO, METODOS_DESTETE, TIPOS_PARTO, type TipoEvento } from "@/lib/reproduccion/validation"

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const NOMBRE: Record<TipoEvento, string> = { servicio: "el servicio", tacto: "el tacto", paricion: "el parto", destete: "el destete", senalada: "la señalada" }

export interface EventoAccion { tipo: TipoEvento; id: string; descripcion: string; valores: Record<string, unknown> }

async function enviar(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(b.error ?? "No se pudo guardar"), { codigo: b.codigo as string | undefined })
  return b.data
}
const mensaje = (e: unknown) => (e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se guardó")

/** Anular un evento con motivo (no se borra). Un parto con crías dadas de alta pide confirmar. */
export function AnularEventoDialog({ evento, onOpenChange, onAnulado }: { evento: EventoAccion | null; onOpenChange: (o: boolean) => void; onAnulado: () => void }) {
  const [motivo, setMotivo] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  // Destete: qué se deshace junto con él
  const [quitarPesada, setQuitarPesada] = useState(true)
  const [volverGrupo, setVolverGrupo] = useState(true)
  useEffect(() => { if (evento) { setMotivo(""); setError(""); setQuitarPesada(true); setVolverGrupo(true) } }, [evento])
  const esDestete = evento?.tipo === "destete"
  async function anular() {
    if (!evento) return
    if (motivo.trim().length < 3) return setError("Indicá por qué se anula")
    setEnviando(true); setError("")
    const url = `/api/reproduccion/eventos/${evento.tipo}/${evento.id}/anular`
    try {
      let r: { anulados: number; aviso: string | null }
      const body = esDestete ? { motivo, quitarPesada, volverGrupo } : { motivo }
      try { r = await enviar(url, "POST", body) } catch (e) {
        if ((e as { codigo?: string }).codigo !== "paricion_con_cria" || !window.confirm((e as Error).message)) throw e
        r = await enviar(url, "POST", { ...body, aceptarCria: true })
      }
      toast.success(r.anulados > 1 ? `Parto anulado (${r.anulados} crías)` : "Evento anulado")
      if (r.aviso) toast.info(r.aviso)
      onOpenChange(false); onAnulado()
    } catch (e) { setError(mensaje(e)) } finally { setEnviando(false) }
  }
  return (
    <Dialog open={!!evento} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Anular {evento ? NOMBRE[evento.tipo] : ""}</DialogTitle><DialogDescription>{evento?.descripcion}. No se borra: queda anulado con el motivo y deja de contar en los indicadores.</DialogDescription></DialogHeader>
        <div className="space-y-1.5"><Label htmlFor="an-motivo">Motivo *</Label><Textarea id="an-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: se cargó en la vaca equivocada" /></div>
        {esDestete && (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={quitarPesada} onChange={(e) => setQuitarPesada(e.target.checked)} />Quitar también la pesada del destete</label>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={volverGrupo} onChange={(e) => setVolverGrupo(e.target.checked)} />Volver el animal al grupo en el que estaba (si no se movió después)</label>
          </div>
        )}
        {evento?.tipo === "senalada" && <p className="text-xs text-muted-foreground">Si se descontó la vacuna del stock, vuelve al inventario.</p>}
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button variant="destructive" onClick={anular} disabled={enviando}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Anular</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type CampoEdicion = { clave: string; etiqueta: string; tipo: "texto" | "largo" | { opciones: [string, string][] } }
const CAMPOS: Record<TipoEvento, CampoEdicion[]> = {
  servicio: [{ clave: "toroNombre", etiqueta: "Toro (semen)", tipo: "texto" }, { clave: "loteSemen", etiqueta: "Partida de semen", tipo: "texto" }, { clave: "inseminador", etiqueta: "Inseminador", tipo: "texto" }, { clave: "observ", etiqueta: "Observaciones", tipo: "largo" }],
  tacto: [{ clave: "veterinario", etiqueta: "Veterinario", tipo: "texto" }, { clave: "observ", etiqueta: "Observaciones", tipo: "largo" }],
  paricion: [
    { clave: "tipoParto", etiqueta: "Tipo de parto", tipo: { opciones: TIPOS_PARTO.map((t) => [t, ETIQUETA_TIPO_PARTO[t]]) } },
    { clave: "dificultad", etiqueta: "Dificultad (1 a 5)", tipo: { opciones: ["1", "2", "3", "4", "5"].map((n) => [n, n]) } },
    { clave: "observ", etiqueta: "Observaciones", tipo: "largo" },
  ],
  destete: [{ clave: "metodo", etiqueta: "Método", tipo: { opciones: METODOS_DESTETE.map((m) => [m, ETIQUETA_METODO_DESTETE[m]]) } }, { clave: "observ", etiqueta: "Observaciones", tipo: "largo" }],
  senalada: [{ clave: "observ", etiqueta: "Observaciones", tipo: "largo" }],
}

/** Editar los datos no críticos de un evento (fecha, animal y resultado no se cambian: se anula y se vuelve a cargar). */
export function EditarEventoDialog({ evento, onOpenChange, onGuardado }: { evento: EventoAccion | null; onOpenChange: (o: boolean) => void; onGuardado: () => void }) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!evento) return
    setError("")
    setValores(Object.fromEntries(CAMPOS[evento.tipo].map((c) => [c.clave, evento.valores[c.clave] == null ? "" : String(evento.valores[c.clave])])))
  }, [evento])
  async function guardar() {
    if (!evento) return
    // Solo lo que cambió; "" borra
    const cambios = Object.fromEntries(Object.entries(valores).filter(([k, v]) => v !== (evento.valores[k] == null ? "" : String(evento.valores[k])))
      .map(([k, v]) => [k, k === "dificultad" ? (v ? Number(v) : null) : k === "tipoParto" || k === "metodo" ? v || null : v]))
    if (!Object.keys(cambios).length) return onOpenChange(false)
    setEnviando(true); setError("")
    try { await enviar(`/api/reproduccion/eventos/${evento.tipo}/${evento.id}`, "PATCH", cambios); toast.success("Cambios guardados"); onOpenChange(false); onGuardado() } catch (e) { setError(mensaje(e)) } finally { setEnviando(false) }
  }
  return (
    <Dialog open={!!evento} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar {evento ? NOMBRE[evento.tipo] : ""}</DialogTitle><DialogDescription>{evento?.descripcion}. Para corregir la fecha, el animal o el resultado, anulalo y cargalo de nuevo.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          {evento && CAMPOS[evento.tipo].map((c) => (
            <div key={c.clave} className="space-y-1.5">
              <Label htmlFor={`ed-${c.clave}`}>{c.etiqueta}</Label>
              {c.tipo === "texto" ? <Input id={`ed-${c.clave}`} maxLength={120} value={valores[c.clave] ?? ""} onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })} />
                : c.tipo === "largo" ? <Textarea id={`ed-${c.clave}`} rows={3} maxLength={1000} value={valores[c.clave] ?? ""} onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })} />
                : <select id={`ed-${c.clave}`} className={selectClass} value={valores[c.clave] ?? ""} onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}><option value="">—</option>{c.tipo.opciones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
            </div>
          ))}
        </div>
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={guardar} disabled={enviando}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface ToradaEditable {
  id: string; nombre: string; fechaInicio: string; fechaFin: string | null; observ: string | null; cantidadHembras: number | null
  lote: { especieId: string }
  machos: { animal: AnimalOpcion }[]
}

/** Cerrar la torada (fecha de fin) y asignar sus toros. */
export function ToradaEditarDialog({ torada, estId, onOpenChange, onGuardado }: { torada: ToradaEditable | null; estId: string; onOpenChange: (o: boolean) => void; onGuardado: () => void }) {
  const [form, setForm] = useState({ nombre: "", fechaFin: "", observ: "", cantidadHembras: "" })
  const [machos, setMachos] = useState<AnimalOpcion[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!torada) return
    setError("")
    setForm({ nombre: torada.nombre, fechaFin: torada.fechaFin ? torada.fechaFin.slice(0, 10) : "", observ: torada.observ ?? "", cantidadHembras: torada.cantidadHembras?.toString() ?? "" })
    setMachos(torada.machos.map((m) => m.animal))
  }, [torada])
  async function guardar() {
    if (!torada) return
    setEnviando(true); setError("")
    try {
      await enviar(`/api/reproduccion/toradas/${torada.id}`, "PATCH", {
        nombre: form.nombre, fechaFin: form.fechaFin || null, observ: form.observ, cantidadHembras: form.cantidadHembras, machoIds: machos.map((m) => m.id),
      })
      toast.success(form.fechaFin && !torada.fechaFin ? "Torada cerrada" : "Torada guardada"); onOpenChange(false); onGuardado()
    } catch (e) { setError(mensaje(e)) } finally { setEnviando(false) }
  }
  return (
    <Dialog open={!!torada} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Torada «{torada?.nombre}»</DialogTitle><DialogDescription>Desde el {torada ? formatoDia(torada.fechaInicio) : ""}. Cargá la fecha de fin para cerrarla y asigná los toros.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5"><Label htmlFor="te-nombre">Nombre</Label><Input id="te-nombre" maxLength={120} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="te-fin">Fin del servicio</Label><Input id="te-fin" type="date" min={torada?.fechaInicio.slice(0, 10)} value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="te-hembras">Cantidad de hembras</Label><Input id="te-hembras" type="number" min="1" value={form.cantidadHembras} onChange={(e) => setForm({ ...form, cantidadHembras: e.target.value })} /></div>
          </div>
          {!form.fechaFin && torada?.fechaFin == null && (
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setForm({ ...form, fechaFin: hoyArgentina() })}>Cerrar hoy</Button>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="te-toro">Toros asignados</Label>
            <div className="flex flex-wrap gap-1.5">
              {machos.length ? machos.map((m) => (
                <Badge key={m.id} variant="secondary" className="gap-1">{etiquetaAnimal(m)}
                  <button type="button" aria-label={`Quitar ${etiquetaAnimal(m)}`} onClick={() => setMachos(machos.filter((x) => x.id !== m.id))}><X className="h-3 w-3" /></button>
                </Badge>
              )) : <span className="text-sm text-muted-foreground">Sin toros asignados</span>}
            </div>
            <AnimalCombobox id="te-toro" estId={estId} sexo="M" especieId={torada?.lote.especieId} value={null} placeholder="Agregar toro"
              onChange={(a) => a && !machos.some((m) => m.id === a.id) && setMachos([...machos, a])} />
          </div>
          <div className="space-y-1.5"><Label htmlFor="te-obs">Observaciones</Label><Textarea id="te-obs" rows={2} maxLength={1000} value={form.observ} onChange={(e) => setForm({ ...form, observ: e.target.value })} /></div>
        </div>
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={guardar} disabled={enviando}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
