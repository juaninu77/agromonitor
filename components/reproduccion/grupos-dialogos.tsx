"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AnimalCombobox, etiquetaAnimal, type AnimalOpcion } from "./animal-combobox"
import { EstadoReproductivoBadge } from "./estado-badge"
import { formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import { esSanitario } from "@/lib/inventario/validation"
import {
  ETIQUETA_METODO_DESTETE, ETIQUETA_METODO_TACTO, ETIQUETA_RESULTADO_TACTO, ETIQUETA_TIPO_SERVICIO, LETRA_RESULTADO_TACTO,
  METODOS_DESTETE, METODOS_TACTO, RESULTADOS_TACTO, TERMINOS_GRUPO, TIPOS_SERVICIO, tipoGrupoDeEspecie, type ResultadoTacto, type TipoGrupo,
} from "@/lib/reproduccion/validation"

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
export interface GrupoOpcion { id: string; nombre: string; especie?: string | null; cantidad?: number }
interface ToradaOpcion { id: string; nombre: string; tipo: string; tipoGrupo: TipoGrupo; fechaInicio: string; fechaFin: string | null; lote: { nombre: string; especieId: string } }
interface HembraTorada {
  id: string; caravanaVisual: string | null; cuig: string | null; categoria: { nombre: string } | null
  estado: { estado: string; desde: string; fechaProbableParto: string | null } | null
  servicioSinTacto: { id: string; fecha: string; tipo: string } | null; servidaEseDia: boolean
}
interface DatosTorada { torada: ToradaOpcion & { lote: { especie: { nombre: string } } }; fecha: string; hembras: HembraTorada[] }

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo cargar")
  return b.data as T
}
async function enviar(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo guardar")
  return b.data
}
const mensaje = (e: unknown) => (e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se guardó (podés reintentar)")
const nombreTorada = (t: ToradaOpcion) => `${TERMINOS_GRUPO[t.tipoGrupo]?.grupo ?? "Torada"} «${t.nombre}» · ${t.lote.nombre}`

function Campo({ id, label, children, className }: { id?: string; label: string; children: ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label htmlFor={id}>{label}</Label>{children}</div>
}

function useToradas(estId: string, open: boolean, soloAbiertas: boolean) {
  return useQuery({
    queryKey: ["repro", "toradas-opciones", estId, soloAbiertas],
    queryFn: async () => {
      const r = await fetch(`/api/reproduccion/toradas?establecimientoId=${estId}&limit=100${soloAbiertas ? "&activa=true" : ""}`)
      const b = await r.json()
      return (b.data ?? []) as ToradaOpcion[]
    },
    enabled: open && !!estId,
  })
}

/** Base de los diálogos por grupo: clave nueva al abrir (el reintento no duplica), envío y error. */
function useOperacion(open: boolean) {
  const [clave, setClave] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { if (open) { setClave(crypto.randomUUID()); setError("") } }, [open])
  async function ejecutar(accion: () => Promise<void>) {
    setEnviando(true); setError("")
    try { await accion() } catch (e) { setError(mensaje(e)) } finally { setEnviando(false) }
  }
  return { clave, enviando, error, setError, ejecutar }
}

function Marco({ open, onOpenChange, titulo, descripcion, enviando, error, textoBoton, deshabilitado, onGuardar, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; titulo: string; descripcion: string; enviando: boolean; error: string
  textoBoton: string; deshabilitado?: boolean; onGuardar: () => void; children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>{descripcion}</DialogDescription></DialogHeader>
        <div className="grid gap-4">{children}</div>
        {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={onGuardar} disabled={enviando || deshabilitado}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{textoBoton}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface Props { open: boolean; onOpenChange: (o: boolean) => void; estId: string; onSuccess: () => void }

/** Servicio de una torada en una operación: en monta natural, todas las hembras del grupo; en IA, las elegidas. */
export function ServicioMasivoDialog({ open, onOpenChange, estId, onSuccess }: Props) {
  const op = useOperacion(open)
  const toradas = useToradas(estId, open, true)
  const [form, setForm] = useState({ toradaId: "", fecha: hoyArgentina(), tipo: "natural", macho: null as AnimalOpcion | null, toroNombre: "", loteSemen: "", inseminador: "", incluirPrenadas: false })
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  useEffect(() => { if (open) { setForm({ toradaId: "", fecha: hoyArgentina(), tipo: "natural", macho: null, toroNombre: "", loteSemen: "", inseminador: "", incluirPrenadas: false }); setElegidas(new Set()) } }, [open])
  const datos = useQuery({
    queryKey: ["repro", "torada-hembras", form.toradaId, form.fecha],
    queryFn: () => getJson<DatosTorada>(`/api/reproduccion/toradas/${form.toradaId}/hembras?fecha=${form.fecha}`),
    enabled: open && !!form.toradaId && /^\d{4}-\d{2}-\d{2}$/.test(form.fecha),
  })
  const torada = toradas.data?.find((t) => t.id === form.toradaId)
  const encarnerada = torada?.tipoGrupo === "encarnerada"
  const hembras = datos.data?.hembras ?? []
  const prenadas = hembras.filter((h) => h.estado?.estado === "preñada" && !h.servidaEseDia).length
  const natural = form.tipo === "natural"
  const aServir = natural ? hembras.filter((h) => !h.servidaEseDia && (form.incluirPrenadas || h.estado?.estado !== "preñada")).length : elegidas.size
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))
  function guardar() {
    if (!form.toradaId) return op.setError("Elegí la torada")
    void op.ejecutar(async () => {
      const r = await enviar("/api/reproduccion/servicios/masivo", {
        clave: op.clave, toradaId: form.toradaId, fecha: form.fecha, tipo: form.tipo, incluirPrenadas: form.incluirPrenadas,
        ...(natural ? { machoId: form.macho?.id ?? null } : { hembraIds: [...elegidas], toroNombre: form.toroNombre, loteSemen: form.loteSemen, inseminador: form.inseminador }),
      }) as { cantidad: number; omitidas: { prenadas: number; yaServidas: number }; repetido: boolean }
      const omit = [r.omitidas.prenadas && `${r.omitidas.prenadas} preñadas`, r.omitidas.yaServidas && `${r.omitidas.yaServidas} ya servidas`].filter(Boolean).join(" y ")
      toast.success(`${r.cantidad} servicios registrados${omit ? ` · se omitieron ${omit}` : ""}${r.repetido ? " (ya estaban guardados)" : ""}`)
      onOpenChange(false); onSuccess()
    })
  }
  return (
    <Marco open={open} onOpenChange={onOpenChange} titulo="Servicio por torada" descripcion="Registra el servicio de las hembras del grupo de la torada en una sola operación. Las que figuran preñadas o ya tienen ese servicio ese día se omiten."
      enviando={op.enviando} error={op.error} textoBoton={`Registrar ${aServir} servicios`} deshabilitado={!aServir} onGuardar={guardar}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo id="sm-torada" label="Torada o encarnerada *" className="sm:col-span-2">
          <select id="sm-torada" className={selectClass} value={form.toradaId} onChange={(e) => { const t = toradas.data?.find((x) => x.id === e.target.value); set({ toradaId: e.target.value, macho: null, tipo: t?.tipoGrupo === "encarnerada" || t?.tipo === "natural" ? "natural" : t?.tipo === "mixto" ? "natural" : t?.tipo ?? "natural", fecha: t && t.fechaInicio.slice(0, 10) > hoyArgentina() ? hoyArgentina() : form.fecha }); setElegidas(new Set()) }}>
            <option value="">Elegir</option>{(toradas.data ?? []).map((t) => <option key={t.id} value={t.id}>{nombreTorada(t)}</option>)}
          </select>
        </Campo>
        <Campo id="sm-fecha" label="Fecha *"><Input id="sm-fecha" type="date" max={hoyArgentina()} min={torada?.fechaInicio.slice(0, 10)} value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} /></Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo id="sm-tipo" label="Tipo">
          <select id="sm-tipo" className={selectClass} value={form.tipo} disabled={encarnerada} onChange={(e) => { set({ tipo: e.target.value, macho: null }); setElegidas(new Set()) }}>
            {TIPOS_SERVICIO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_SERVICIO[t]}</option>)}
          </select>
        </Campo>
        {natural ? (
          <Campo id="sm-macho" label={encarnerada ? "Carnero (opcional)" : "Toro (opcional)"} className="sm:col-span-2">
            <AnimalCombobox id="sm-macho" estId={estId} sexo="M" especieId={torada?.lote.especieId} value={form.macho} onChange={(a) => set({ macho: a })} placeholder={torada ? "Buscar" : "Elegí la torada"} disabled={!torada} />
          </Campo>
        ) : (
          <>
            <Campo id="sm-toro" label="Toro (semen)"><Input id="sm-toro" maxLength={120} value={form.toroNombre} onChange={(e) => set({ toroNombre: e.target.value })} /></Campo>
            <Campo id="sm-insem" label="Inseminador"><Input id="sm-insem" maxLength={120} value={form.inseminador} onChange={(e) => set({ inseminador: e.target.value })} /></Campo>
          </>
        )}
      </div>
      {form.toradaId && (
        <div className="rounded-md border p-3 text-sm">
          {datos.isFetching ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando hembras…</p>
            : datos.isError ? <p role="alert" className="text-destructive">{datos.error.message}</p>
            : natural ? (
              <div className="space-y-2">
                <p><strong>{hembras.length}</strong> hembras en el grupo ese día · se registran <strong>{aServir}</strong>.</p>
                {prenadas > 0 && <label className="flex items-center gap-2"><input type="checkbox" checked={form.incluirPrenadas} onChange={(e) => set({ incluirPrenadas: e.target.checked })} />Incluir las {prenadas} que figuran preñadas</label>}
              </div>
            ) : (
              <ListaHembras hembras={hembras} elegidas={elegidas} onCambiar={setElegidas} />
            )}
        </div>
      )}
    </Marco>
  )
}

function ListaHembras({ hembras, elegidas, onCambiar }: { hembras: HembraTorada[]; elegidas: Set<string>; onCambiar: (s: Set<string>) => void }) {
  const disponibles = hembras.filter((h) => !h.servidaEseDia)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span>{elegidas.size} de {disponibles.length} elegidas</span>
        <Button type="button" variant="outline" size="sm" onClick={() => onCambiar(new Set(elegidas.size ? [] : disponibles.filter((h) => h.estado?.estado !== "preñada").map((h) => h.id)))}>{elegidas.size ? "Ninguna" : "Todas menos preñadas"}</Button>
      </div>
      <ul className="max-h-64 divide-y overflow-y-auto">
        {hembras.map((h) => (
          <li key={h.id}>
            <label className={`flex items-center gap-2 py-1.5 ${h.servidaEseDia ? "opacity-50" : ""}`}>
              <input type="checkbox" disabled={h.servidaEseDia} checked={elegidas.has(h.id)} onChange={(e) => { const s = new Set(elegidas); if (e.target.checked) s.add(h.id); else s.delete(h.id); onCambiar(s) }} />
              <span className="font-medium">{etiquetaAnimal(h)}</span><span className="text-xs text-muted-foreground">{h.categoria?.nombre}</span>
              <EstadoReproductivoBadge estado={h.estado} className="ml-auto" />{h.servidaEseDia && <span className="text-xs">ya servida</span>}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Planilla de tacto de una torada: un resultado por hembra, vinculado a su servicio. */
export function PlanillaTactoDialog({ open, onOpenChange, estId, onSuccess }: Props) {
  const op = useOperacion(open)
  const toradas = useToradas(estId, open, false)
  const [form, setForm] = useState({ toradaId: "", fecha: hoyArgentina(), metodo: "palpacion", veterinario: "" })
  const [resultados, setResultados] = useState<Record<string, { resultado: ResultadoTacto; meses: string }>>({})
  const [filtro, setFiltro] = useState("")
  useEffect(() => { if (open) { setForm({ toradaId: "", fecha: hoyArgentina(), metodo: "palpacion", veterinario: "" }); setResultados({}); setFiltro("") } }, [open])
  const datos = useQuery({
    queryKey: ["repro", "torada-hembras", form.toradaId, "tacto"],
    queryFn: () => getJson<DatosTorada>(`/api/reproduccion/toradas/${form.toradaId}/hembras`),
    enabled: open && !!form.toradaId,
  })
  const hembras = useMemo(() => (datos.data?.hembras ?? []).filter((h) => !filtro || etiquetaAnimal(h).toLowerCase().includes(filtro.toLowerCase())), [datos.data, filtro])
  const cargados = Object.keys(resultados).length
  const conteo = Object.values(resultados).reduce((n, r) => ({ ...n, [r.resultado]: (n[r.resultado] ?? 0) + 1 }), {} as Record<string, number>)
  const marcar = (id: string, r: ResultadoTacto) => setResultados((s) => {
    const n = { ...s }
    if (n[id]?.resultado === r) delete n[id]; else n[id] = { resultado: r, meses: r === "preñada" ? n[id]?.meses ?? "" : "" }
    return n
  })
  function guardar() {
    if (!cargados) return op.setError("Cargá al menos un resultado")
    void op.ejecutar(async () => {
      const r = await enviar("/api/reproduccion/tactos/masivo", {
        clave: op.clave, fecha: form.fecha, metodo: form.metodo, veterinario: form.veterinario, toradaId: form.toradaId || null,
        filas: Object.entries(resultados).map(([hembraId, x]) => ({ hembraId, resultado: x.resultado, mesesGest: x.resultado === "preñada" && x.meses ? x.meses : null })),
      }) as { cantidad: number; prenadas: number; vinculados: number }
      toast.success(`${r.cantidad} tactos registrados · ${r.prenadas} preñadas · ${r.vinculados} vinculados a su servicio`)
      onOpenChange(false); onSuccess()
    })
  }
  return (
    <Marco open={open} onOpenChange={onOpenChange} titulo="Planilla de tacto" descripcion="Cargá el resultado de cada hembra (P preñada, V vacía, D dudosa, A absorción). Se vinculan a su servicio y la fecha de parto se calcula sola."
      enviando={op.enviando} error={op.error} textoBoton={`Registrar ${cargados} tactos`} deshabilitado={!cargados} onGuardar={guardar}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo id="pt-torada" label="Torada o encarnerada *" className="sm:col-span-2">
          <select id="pt-torada" className={selectClass} value={form.toradaId} onChange={(e) => { setForm({ ...form, toradaId: e.target.value }); setResultados({}) }}>
            <option value="">Elegir</option>{(toradas.data ?? []).map((t) => <option key={t.id} value={t.id}>{nombreTorada(t)}</option>)}
          </select>
        </Campo>
        <Campo id="pt-fecha" label="Fecha *"><Input id="pt-fecha" type="date" max={hoyArgentina()} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Campo>
        <Campo id="pt-metodo" label="Método">
          <select id="pt-metodo" className={selectClass} value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}>{METODOS_TACTO.map((m) => <option key={m} value={m}>{ETIQUETA_METODO_TACTO[m]}</option>)}</select>
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="pt-vet" label="Veterinario"><Input id="pt-vet" maxLength={120} value={form.veterinario} onChange={(e) => setForm({ ...form, veterinario: e.target.value })} /></Campo>
        <Campo id="pt-buscar" label="Buscar en la planilla"><Input id="pt-buscar" placeholder="Caravana…" value={filtro} onChange={(e) => setFiltro(e.target.value)} /></Campo>
      </div>
      {form.toradaId && (
        datos.isFetching ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando hembras…</p>
        : datos.isError ? <p role="alert" className="text-sm text-destructive">{datos.error.message}</p>
        : (
          <div className="space-y-2">
            <p className="text-sm" role="status">{cargados} cargados de {datos.data?.hembras.length ?? 0}{cargados ? ` · ${RESULTADOS_TACTO.filter((r) => conteo[r]).map((r) => `${conteo[r]} ${ETIQUETA_RESULTADO_TACTO[r].toLowerCase()}`).join(", ")}` : ""}</p>
            <ul className="max-h-[45vh] divide-y overflow-y-auto rounded-md border">
              {hembras.map((h) => {
                const r = resultados[h.id]
                return (
                  <li key={h.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-sm">
                    <span className="w-28 font-medium">{etiquetaAnimal(h)}</span>
                    <span className="hidden w-40 text-xs text-muted-foreground sm:inline">{h.servicioSinTacto ? `Servicio ${formatoDia(h.servicioSinTacto.fecha)}` : "Sin servicio pendiente"}</span>
                    <EstadoReproductivoBadge estado={h.estado} />
                    <span className="ml-auto flex items-center gap-1" role="group" aria-label={`Resultado de ${etiquetaAnimal(h)}`}>
                      {RESULTADOS_TACTO.map((x) => (
                        <Button key={x} type="button" size="sm" variant={r?.resultado === x ? "default" : "outline"} className="h-8 w-8 p-0" aria-pressed={r?.resultado === x} title={ETIQUETA_RESULTADO_TACTO[x]} onClick={() => marcar(h.id, x)}>
                          {LETRA_RESULTADO_TACTO[x]}
                        </Button>
                      ))}
                      {r?.resultado === "preñada" && (
                        <Input aria-label={`Meses de gestación de ${etiquetaAnimal(h)}`} className="h-8 w-20" type="number" min="0.5" max="10" step="0.5" placeholder="meses"
                          value={r.meses} onChange={(e) => setResultados((s) => ({ ...s, [h.id]: { ...s[h.id], meses: e.target.value } }))} />
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      )}
    </Marco>
  )
}

interface CriaGrupo { id: string; caravanaVisual: string | null; cuig: string | null; sexo: string; fechaNacimiento: string | null; edadDias: number | null; madre: string | null; categoria: { nombre: string } | null }

/** Destete de varios animales de un grupo: pesada, cambio de grupo y edad para cada uno. */
export function DesteteMasivoDialog({ open, onOpenChange, estId, lotes, onSuccess }: Props & { lotes: GrupoOpcion[] }) {
  const op = useOperacion(open)
  const [form, setForm] = useState({ loteId: "", fecha: hoyArgentina(), metodo: "", loteDesteteId: "" })
  const [elegidos, setElegidos] = useState<Record<string, string>>({})
  useEffect(() => { if (open) { setForm({ loteId: "", fecha: hoyArgentina(), metodo: "", loteDesteteId: "" }); setElegidos({}) } }, [open])
  const crias = useQuery({
    queryKey: ["repro", "crias", form.loteId],
    queryFn: () => getJson<{ animales: CriaGrupo[] }>(`/api/reproduccion/grupos/${form.loteId}/crias`),
    enabled: open && !!form.loteId,
  })
  const animales = crias.data?.animales ?? []
  const n = Object.keys(elegidos).length
  const origen = lotes.find((l) => l.id === form.loteId)
  function guardar() {
    if (!n) return op.setError("Elegí al menos un animal")
    void op.ejecutar(async () => {
      const r = await enviar("/api/reproduccion/destetes/masivo", {
        clave: op.clave, fecha: form.fecha, metodo: form.metodo, loteDesteteId: form.loteDesteteId || null,
        filas: Object.entries(elegidos).map(([animalId, peso]) => ({ animalId, pesoKg: peso || null })),
      }) as { cantidad: number; movidos: number; sinCaravana: number }
      toast.success(`${r.cantidad} destetes registrados${r.movidos ? ` · ${r.movidos} pasaron al grupo de destete` : ""}`)
      if (r.sinCaravana) toast.warning(`${r.sinCaravana} bovinos no tienen caravana electrónica: es obligatoria después del destete.`, { duration: 8000 })
      onOpenChange(false); onSuccess()
    })
  }
  return (
    <Marco open={open} onOpenChange={onOpenChange} titulo="Destete por grupo" descripcion="Elegí los terneros o corderos del grupo (nacidos en los últimos 18 meses) y cargá su peso: cada uno queda con su pesada y pasa al grupo de destete."
      enviando={op.enviando} error={op.error} textoBoton={`Destetar ${n}`} deshabilitado={!n} onGuardar={guardar}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo id="dm-grupo" label="Grupo *" className="sm:col-span-2">
          <select id="dm-grupo" className={selectClass} value={form.loteId} onChange={(e) => { setForm({ ...form, loteId: e.target.value }); setElegidos({}) }}>
            <option value="">Elegir</option>{lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}{l.cantidad != null ? ` (${l.cantidad})` : ""}</option>)}
          </select>
        </Campo>
        <Campo id="dm-fecha" label="Fecha *"><Input id="dm-fecha" type="date" max={hoyArgentina()} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Campo>
        <Campo id="dm-metodo" label="Método">
          <select id="dm-metodo" className={selectClass} value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}><option value="">—</option>{METODOS_DESTETE.map((m) => <option key={m} value={m}>{ETIQUETA_METODO_DESTETE[m]}</option>)}</select>
        </Campo>
      </div>
      <Campo id="dm-destino" label="Grupo de destete">
        <select id="dm-destino" className={selectClass} value={form.loteDesteteId} onChange={(e) => setForm({ ...form, loteDesteteId: e.target.value })}>
          <option value="">Quedan en su grupo</option>{lotes.filter((l) => l.id !== form.loteId && (!origen?.especie || l.especie === origen.especie)).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
      </Campo>
      {form.loteId && (
        crias.isFetching ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</p>
        : crias.isError ? <p role="alert" className="text-sm text-destructive">{crias.error.message}</p>
        : !animales.length ? <p className="text-sm text-muted-foreground">No hay animales sin destetar en el grupo.</p>
        : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{n} de {animales.length} elegidos</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setElegidos(n ? {} : Object.fromEntries(animales.map((a) => [a.id, ""])))}>{n ? "Ninguno" : "Todos"}</Button>
            </div>
            <ul className="max-h-[45vh] divide-y overflow-y-auto rounded-md border">
              {animales.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-sm">
                  <input type="checkbox" aria-label={`Destetar ${etiquetaAnimal(a)}`} checked={a.id in elegidos} onChange={(e) => setElegidos((s) => { const x = { ...s }; if (e.target.checked) x[a.id] = ""; else delete x[a.id]; return x })} />
                  <span className="w-28 font-medium">{etiquetaAnimal(a)}</span>
                  <span className="text-xs text-muted-foreground">{[a.sexo === "M" ? "macho" : "hembra", a.edadDias != null ? `${a.edadDias} días` : null, a.madre ? `madre ${a.madre}` : null].filter(Boolean).join(" · ")}</span>
                  <Input aria-label={`Peso de ${etiquetaAnimal(a)}`} className="ml-auto h-8 w-24" type="number" min="0" step="0.5" placeholder="kg" disabled={!(a.id in elegidos)}
                    value={elegidos[a.id] ?? ""} onChange={(e) => setElegidos((s) => ({ ...s, [a.id]: e.target.value }))} />
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </Marco>
  )
}

/** Señalada de corderos de un grupo ovino (spec 03 §3.4). */
export function SenaladaDialog({ open, onOpenChange, estId, lotes, onSuccess }: Props & { lotes: GrupoOpcion[] }) {
  const op = useOperacion(open)
  const toradas = useToradas(estId, open, false)
  const ovinos = lotes.filter((l) => tipoGrupoDeEspecie(l.especie) === "encarnerada")
  const vacio = { loteId: "", toradaId: "", fecha: hoyArgentina(), corderosSenalados: "", corderosMuertos: "", machosMantenidos: "", machosCastrados: "", hembras: "", productoClostridialId: "", observ: "" }
  const [form, setForm] = useState(vacio)
  useEffect(() => { if (open) setForm(vacio) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const productos = useQuery({
    queryKey: ["repro", "productos-sanitarios"],
    queryFn: async () => { const r = await fetch("/api/inventario?limit=500"); const b = await r.json(); return ((b.data ?? []) as { id: string; nombre: string; tipo: string; activo?: boolean }[]).filter((p) => p.activo !== false && esSanitario(p.tipo)) },
    enabled: open, staleTime: 300_000,
  })
  const suma = ["machosMantenidos", "machosCastrados", "hembras"].reduce((n, k) => n + (Number(form[k as keyof typeof form]) || 0), 0)
  const total = Number(form.corderosSenalados) || 0
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))
  function guardar() {
    if (!form.loteId) return op.setError("Elegí el grupo")
    if (suma && suma !== total) return op.setError("Machos enteros + castrados + hembras tiene que sumar los corderos señalados")
    void op.ejecutar(async () => {
      await enviar("/api/reproduccion/senaladas", { ...form, clave: op.clave, toradaId: form.toradaId || null, productoClostridialId: form.productoClostridialId || null })
      toast.success(`Señalada registrada: ${total} corderos`)
      onOpenChange(false); onSuccess()
    })
  }
  return (
    <Marco open={open} onOpenChange={onOpenChange} titulo="Señalada" descripcion="Marcación de los corderos de un grupo (señal, castración, descole y vacuna). Base del % señalada sobre las ovejas encarneradas."
      enviando={op.enviando} error={op.error} textoBoton="Registrar señalada" onGuardar={guardar}>
      {!ovinos.length && <p className="erp-notice text-sm">El campo no tiene grupos de ovinos.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo id="se-grupo" label="Grupo *"><select id="se-grupo" className={selectClass} value={form.loteId} onChange={(e) => set({ loteId: e.target.value })}><option value="">Elegir</option>{ovinos.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></Campo>
        <Campo id="se-enc" label="Encarnerada"><select id="se-enc" className={selectClass} value={form.toradaId} onChange={(e) => set({ toradaId: e.target.value })}><option value="">—</option>{(toradas.data ?? []).filter((t) => t.tipoGrupo === "encarnerada").map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></Campo>
        <Campo id="se-fecha" label="Fecha *"><Input id="se-fecha" type="date" max={hoyArgentina()} value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} /></Campo>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Campo id="se-total" label="Señalados *"><Input id="se-total" type="number" min="1" value={form.corderosSenalados} onChange={(e) => set({ corderosSenalados: e.target.value })} /></Campo>
        <Campo id="se-muertos" label="Muertos antes"><Input id="se-muertos" type="number" min="0" value={form.corderosMuertos} onChange={(e) => set({ corderosMuertos: e.target.value })} /></Campo>
        <Campo id="se-enteros" label="Machos enteros"><Input id="se-enteros" type="number" min="0" value={form.machosMantenidos} onChange={(e) => set({ machosMantenidos: e.target.value })} /></Campo>
        <Campo id="se-castrados" label="Castrados"><Input id="se-castrados" type="number" min="0" value={form.machosCastrados} onChange={(e) => set({ machosCastrados: e.target.value })} /></Campo>
        <Campo id="se-hembras" label="Hembras"><Input id="se-hembras" type="number" min="0" value={form.hembras} onChange={(e) => set({ hembras: e.target.value })} /></Campo>
      </div>
      {suma > 0 && <p className={`text-xs ${suma === total ? "text-muted-foreground" : "text-destructive"}`} role="status">Desglose: {suma} de {total} señalados</p>}
      <Campo id="se-vacuna" label="Vacuna clostridial"><select id="se-vacuna" className={selectClass} value={form.productoClostridialId} onChange={(e) => set({ productoClostridialId: e.target.value })}><option value="">—</option>{(productos.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Campo>
      <Campo id="se-obs" label="Observaciones"><Textarea id="se-obs" rows={2} maxLength={1000} value={form.observ} onChange={(e) => set({ observ: e.target.value })} /></Campo>
    </Marco>
  )
}
