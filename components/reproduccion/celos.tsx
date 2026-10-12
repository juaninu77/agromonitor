"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, Flame, Loader2, ScanLine, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AnimalCombobox, type AnimalOpcion } from "./animal-combobox"
import { normalizeEID } from "@/lib/hardware/eid"
import { formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import {
  ETIQUETA_ESTADO_REPRODUCTIVO, ETIQUETA_INTERVALO, ETIQUETA_METODO_CELO, ETIQUETA_MOMENTO_CELO, METODOS_CELO, MOMENTOS_CELO,
  type CalificacionIntervalo, type EstadoReproductivo, type MomentoCelo,
} from "@/lib/reproduccion/validation"

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
interface Sugerencia { fecha: string; momento: MomentoCelo; texto: string }

async function enviar(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo guardar")
  return b.data
}
const mensaje = (e: unknown) => (e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se guardó")
/** Turno actual en Argentina: hasta las 13 h, mañana. */
const turnoActual = (): MomentoCelo =>
  Number(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hour12: false })) < 13 ? "manana" : "tarde"
/** «hoy a la tarde», «mañana a la mañana» o «el 13/10/2026 a la mañana». */
export function textoInseminar(s: Sugerencia) {
  const hoy = hoyArgentina(), manana = new Date(Date.parse(`${hoy}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  const dia = s.fecha === hoy ? "hoy" : s.fecha === manana ? "mañana" : `el ${formatoDia(s.fecha)}`
  return `${dia} a la ${ETIQUETA_MOMENTO_CELO[s.momento].toLowerCase()}`
}

function Campo({ id, label, children }: { id?: string; label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>
}

function TurnoYMetodo({ prefijo, fecha, momento, metodo, set }: { prefijo: string; fecha: string; momento: MomentoCelo; metodo: string; set: (p: { fecha?: string; momento?: MomentoCelo; metodo?: string }) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Campo id={`${prefijo}-fecha`} label="Fecha *"><Input id={`${prefijo}-fecha`} type="date" max={hoyArgentina()} value={fecha} onChange={(e) => set({ fecha: e.target.value })} required /></Campo>
      <Campo id={`${prefijo}-momento`} label="Turno *">
        <select id={`${prefijo}-momento`} className={selectClass} value={momento} onChange={(e) => set({ momento: e.target.value as MomentoCelo })}>
          {MOMENTOS_CELO.map((m) => <option key={m} value={m}>{ETIQUETA_MOMENTO_CELO[m]}</option>)}
        </select>
      </Campo>
      <Campo id={`${prefijo}-metodo`} label="Detección">
        <select id={`${prefijo}-metodo`} className={selectClass} value={metodo} onChange={(e) => set({ metodo: e.target.value })}>
          {METODOS_CELO.map((m) => <option key={m} value={m}>{ETIQUETA_METODO_CELO[m]}</option>)}
        </select>
      </Campo>
    </div>
  )
}

/** Registrar el celo de una hembra: al guardar avisa cuándo inseminar y ofrece registrar el servicio. */
export function CeloDialog({ open, onOpenChange, estId, onSuccess, onInseminar, hembraInicial }: {
  open: boolean; onOpenChange: (o: boolean) => void; estId: string; onSuccess: () => void
  onInseminar?: (hembraId: string) => void; hembraInicial?: string | null
}) {
  const [form, setForm] = useState({ fecha: hoyArgentina(), momento: turnoActual(), metodo: "observado", observ: "", hembra: null as AnimalOpcion | null })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))
  useEffect(() => {
    if (!open) return
    setForm({ fecha: hoyArgentina(), momento: turnoActual(), metodo: "observado", observ: "", hembra: null }); setError("")
    if (hembraInicial) void fetch(`/api/reproduccion/animales?establecimientoId=${estId}&id=${hembraInicial}`).then((x) => x.json()).then((b) => b.data?.[0] && set({ hembra: b.data[0] })).catch(() => {})
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    if (!form.hembra) return setError("Elegí la hembra")
    setEnviando(true); setError("")
    try {
      const r = await enviar("/api/reproduccion/celos", { hembraId: form.hembra.id, fecha: form.fecha, momento: form.momento, metodo: form.metodo, observ: form.observ })
      const hembraId = form.hembra.id
      toast.success(`Celo registrado. Inseminar ${textoInseminar(r.sugerencia)}`, {
        description: r.aviso ?? undefined, duration: 10_000,
        ...(onInseminar ? { action: { label: "Registrar servicio", onClick: () => onInseminar(hembraId) } } : {}),
      })
      onOpenChange(false); onSuccess()
    } catch (e) { setError(mensaje(e)) } finally { setEnviando(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Registrar celo</DialogTitle>
          <DialogDescription>Regla AM/PM: el celo visto a la mañana se insemina esa tarde; el de la tarde, a la mañana siguiente.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void guardar() }}>
          <Campo id="ce-hembra" label="Hembra *"><AnimalCombobox id="ce-hembra" estId={estId} sexo="F" value={form.hembra} onChange={(a) => set({ hembra: a })} placeholder="Buscar hembra…" /></Campo>
          <TurnoYMetodo prefijo="ce" fecha={form.fecha} momento={form.momento} metodo={form.metodo} set={set} />
          <Campo id="ce-obs" label="Observaciones"><Textarea id="ce-obs" rows={2} maxLength={1000} value={form.observ} onChange={(e) => set({ observ: e.target.value })} placeholder="Ej.: monta a otras, moco cristalino" /></Campo>
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
            <Button type="submit" disabled={enviando}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar celo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface ResultadoRapido { registrados: number; repetido: boolean; hembras: { id: string; caravana: string }[]; omitidos: { identificador: string; motivo: string }[]; prenadas: string[]; sugerencia: Sugerencia }
/** Identificador comparable: el EID normalizado o la caravana en minúsculas. */
const claveIdent = (s: string) => normalizeEID(s) ?? s.trim().toLowerCase()

/**
 * Carga rápida de celos: se escriben o se leen con el bastón (modo teclado: cada lectura termina
 * en Enter) las caravanas o EID de las hembras en celo del turno, y se registran juntas.
 */
export function CargaRapidaCelosDialog({ open, onOpenChange, estId, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; estId: string; onSuccess: () => void }) {
  const [turno, setTurno] = useState({ fecha: hoyArgentina(), momento: turnoActual(), metodo: "observado" })
  const [lista, setLista] = useState<string[]>([])
  const [texto, setTexto] = useState("")
  const [clave, setClave] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [resultado, setResultado] = useState<ResultadoRapido | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const nueva = () => { setLista([]); setTexto(""); setError(""); setResultado(null); setClave(crypto.randomUUID()) }
  useEffect(() => { if (open) { setTurno({ fecha: hoyArgentina(), momento: turnoActual(), metodo: "observado" }); nueva() } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function agregar(valor: string) {
    // Acepta varias pegadas juntas (separadas por espacios, comas o renglones); el EID tal cual lo manda el bastón
    const partes = valor.split(/[\n,;\t]+|\s{2,}/).map((p) => p.trim()).filter(Boolean)
    const piezas = partes.length === 1 && !normalizeEID(partes[0]) ? partes[0].split(/\s+/) : partes
    if (!piezas.length) return
    setLista((l) => {
      const vistas = new Set(l.map(claveIdent))
      const nuevas = piezas.filter((p) => { const k = claveIdent(p); if (vistas.has(k)) return false; vistas.add(k); return true })
      if (nuevas.length && typeof navigator !== "undefined") navigator.vibrate?.(40)
      return [...l, ...nuevas]
    })
    setTexto("")
    // La lista cambió: es otra carga (otra clave), salvo un reintento de la misma
    setClave(crypto.randomUUID())
  }

  async function registrar() {
    // Lo que quedó escrito sin Enter también va (sin cambiar la clave: un reintento no duplica)
    const pendiente = texto.trim() && !lista.some((x) => claveIdent(x) === claveIdent(texto)) ? [...lista, texto.trim()] : lista
    if (!pendiente.length) return setError("Cargá al menos una caravana")
    setLista(pendiente); setTexto("")
    setEnviando(true); setError("")
    try {
      const r: ResultadoRapido = await enviar("/api/reproduccion/celos/rapida", { establecimientoId: estId, ...turno, identificadores: pendiente, clave })
      setResultado(r)
      toast.success(r.repetido ? "Esa carga ya estaba registrada" : `${r.registrados} ${r.registrados === 1 ? "celo registrado" : "celos registrados"}. Inseminar ${textoInseminar(r.sugerencia)}`)
      onSuccess()
    } catch (e) { setError(mensaje(e)) } finally { setEnviando(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Carga rápida de celos</DialogTitle>
          <DialogDescription>Escribí o leé con el bastón (modo teclado) la caravana, CUIG o EID de cada hembra en celo del turno.</DialogDescription>
        </DialogHeader>
        {resultado ? (
          <div className="space-y-3 text-sm">
            <p className="rounded-md border border-green-200 bg-green-50 p-3 text-green-900 dark:bg-green-950/40 dark:text-green-100">
              {resultado.repetido ? `Esa carga ya estaba registrada (${resultado.registrados}).` : (resultado.registrados === 1 ? "Se registró 1 celo." : `Se registraron ${resultado.registrados} celos.`)}
              {" "}Inseminar <strong>{textoInseminar(resultado.sugerencia)}</strong>: quedan en la agenda hasta registrar el servicio.
            </p>
            {resultado.prenadas.length > 0 && (
              <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Figuran preñadas: {resultado.prenadas.join(", ")}. Un celo puede indicar que perdieron la preñez: revisalas antes de inseminar.
              </p>
            )}
            {resultado.omitidos.length > 0 && (
              <div>
                <p className="mb-1 font-medium">No se registraron ({resultado.omitidos.length}):</p>
                <ul className="space-y-1 text-muted-foreground">{resultado.omitidos.map((o) => <li key={o.identificador}><span className="font-mono text-foreground">{o.identificador}</span> · {o.motivo}</li>)}</ul>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={nueva}>Cargar otro turno</Button>
              <Button onClick={() => onOpenChange(false)}>Listo</Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void registrar() }}>
            <TurnoYMetodo prefijo="cr" fecha={turno.fecha} momento={turno.momento} metodo={turno.metodo} set={(p) => { setTurno((t) => ({ ...t, ...p })); setClave(crypto.randomUUID()) }} />
            <Campo id="cr-ident" label="Caravana o EID">
              <div className="flex gap-2">
                <Input id="cr-ident" ref={input} autoFocus autoComplete="off" value={texto} placeholder="Leé con el bastón o escribí y Enter"
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(texto); input.current?.focus() } }}
                  onPaste={(e) => { const t = e.clipboardData.getData("text"); if (/[\n,;\t]/.test(t)) { e.preventDefault(); agregar(t) } }} />
                <Button type="button" variant="outline" onClick={() => { agregar(texto); input.current?.focus() }}><ScanLine className="mr-1 h-4 w-4" />Agregar</Button>
              </div>
            </Campo>
            <div>
              <p className="mb-2 text-sm text-muted-foreground">{lista.length ? `${lista.length} ${lista.length === 1 ? "hembra" : "hembras"} en la lista` : "La lista está vacía."}</p>
              {lista.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {lista.map((x) => (
                    <li key={x}><Badge variant="secondary" className="gap-1 font-mono">{x}
                      <button type="button" aria-label={`Quitar ${x}`} onClick={() => { setLista((l) => l.filter((y) => y !== x)); setClave(crypto.randomUUID()) }}><X className="h-3 w-3" /></button>
                    </Badge></li>
                  ))}
                </ul>
              )}
            </div>
            {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
              <Button type="submit" disabled={enviando || (!lista.length && !texto.trim())}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar {lista.length || ""} {lista.length === 1 ? "celo" : "celos"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Análisis ───────────────────────────────────────────────────────────────

interface Analisis {
  porInseminar: { id: string; hembraId: string; caravana: string | null; fecha: string; momento: MomentoCelo; metodo: string; sugerencia: Sugerencia }[]
  irregulares: { hembraId: string; caravana: string; fecha: string; dias: number; calificacion: Exclude<CalificacionIntervalo, "regular"> }[]
  sinCelo: { hembraId: string; caravana: string; especie: string; categoria: string | null; ultimoCelo: string | null; estado: string | null; desde: string | null }[]
  totalSinCelo: number
  resumen: { celos30: number; hembras30: number; porcentajeRegulares: number | null; conIntervalo: number }
  referencia: string
}

export const CLASE_INTERVALO: Record<CalificacionIntervalo, string> = {
  regular: "bg-green-100 text-green-800 border-green-200", doble: "bg-amber-100 text-amber-800 border-amber-200",
  corto: "bg-orange-100 text-orange-800 border-orange-200", largo: "bg-red-100 text-red-800 border-red-200",
}
export const IntervaloBadge = ({ dias, calificacion }: { dias: number; calificacion: CalificacionIntervalo }) => (
  <Badge className={CLASE_INTERVALO[calificacion]} title={ETIQUETA_INTERVALO[calificacion]}>{dias} d · {ETIQUETA_INTERVALO[calificacion]}</Badge>
)

/** Para inseminar hoy, intervalos fuera de lo normal y hembras sin celo (los datos los arma el servidor). */
export function CelosAnalisis({ estId, puedeServicio, onInseminar }: { estId: string; puedeServicio: boolean; onInseminar: (hembraId: string) => void }) {
  const q = useQuery({
    queryKey: ["repro", "celos-analisis", estId],
    queryFn: async () => { const r = await fetch(`/api/reproduccion/celos/analisis?establecimientoId=${estId}`); const b = await r.json(); if (!r.ok) throw new Error(b.error ?? "No se pudo cargar"); return b.data as Analisis },
    enabled: !!estId,
  })
  if (q.isPending) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Cargando" /></div>
  if (q.isError) return <p role="alert" className="erp-error">{q.error.message} <button className="underline" onClick={() => q.refetch()}>Reintentar</button></p>
  const d = q.data
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Dato titulo="Celos (30 días)" valor={d.resumen.celos30} detalle={`${d.resumen.hembras30} ${d.resumen.hembras30 === 1 ? "hembra" : "hembras"}`} />
        <Dato titulo="Intervalos regulares" valor={d.resumen.porcentajeRegulares != null ? `${d.resumen.porcentajeRegulares} %` : "—"} detalle={`de ${d.resumen.conIntervalo} con celo anterior (120 días)`} />
        <Dato titulo="Para inseminar" valor={d.porInseminar.length} detalle="celos de hoy y ayer sin servicio" />
        <Dato titulo="Sin celo" valor={d.totalSinCelo} detalle="hace 30 días o más, para revisar" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Flame className="h-5 w-5 text-orange-600" aria-hidden />Para inseminar</CardTitle>
          <CardDescription>Celos recientes sin servicio registrado. Al registrar el servicio salen de la lista y de la agenda.</CardDescription>
        </CardHeader>
        <CardContent>
          {!d.porInseminar.length ? <p className="text-sm text-muted-foreground">No hay hembras para inseminar ahora.</p> : (
            <ul className="divide-y">
              {d.porInseminar.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span><strong>{c.caravana ?? "Sin caravana"}</strong>
                    <span className="block text-xs text-muted-foreground">Celo del {formatoDia(c.fecha)} a la {ETIQUETA_MOMENTO_CELO[c.momento].toLowerCase()} · {ETIQUETA_METODO_CELO[c.metodo as keyof typeof ETIQUETA_METODO_CELO] ?? c.metodo}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className={c.sugerencia.fecha < hoyArgentina() ? "border-amber-300 text-amber-800" : ""}>Inseminar {textoInseminar(c.sugerencia)}</Badge>
                    {puedeServicio && <Button size="sm" variant="outline" onClick={() => onInseminar(c.hembraId)}>Registrar servicio</Button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Intervalos fuera de lo normal</CardTitle>
            <CardDescription>{d.referencia.split(".")[0]}. «Celo no detectado»: el doble del intervalo (se perdió uno).</CardDescription>
          </CardHeader>
          <CardContent>
            {!d.irregulares.length ? <p className="text-sm text-muted-foreground">Sin intervalos irregulares en los últimos 120 días.</p> : (
              <ul className="divide-y text-sm">
                {d.irregulares.slice(0, 50).map((h) => (
                  <li key={h.hembraId} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/ganado/${h.hembraId}`} className="font-medium text-primary underline-offset-2 hover:underline">{h.caravana}</Link>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">celo del {formatoDia(h.fecha)}<IntervaloBadge dias={h.dias} calificacion={h.calificacion} /></span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Hembras sin celo para revisar</CardTitle>
            <CardDescription>Sin celo ni servicio en 30 días (sin las preñadas, las servidas ni las paridas hace menos de 45 días). Solo de las especies en las que se registran celos.</CardDescription>
          </CardHeader>
          <CardContent>
            {!d.sinCelo.length ? <p className="text-sm text-muted-foreground">Ninguna para revisar.</p> : (
              <>
                <ul className="max-h-80 divide-y overflow-y-auto text-sm">
                  {d.sinCelo.map((h) => (
                    <li key={h.hembraId} className="flex items-center justify-between gap-2 py-2">
                      <span><Link href={`/ganado/${h.hembraId}`} className="font-medium text-primary underline-offset-2 hover:underline">{h.caravana}</Link>
                        <span className="ml-2 text-xs text-muted-foreground">{[h.categoria, h.estado ? ETIQUETA_ESTADO_REPRODUCTIVO[h.estado as EstadoReproductivo] : null].filter(Boolean).join(" · ")}</span></span>
                      <span className="text-xs text-muted-foreground">{h.ultimoCelo ? `último celo ${formatoDia(h.ultimoCelo)}` : "sin celos registrados"}</span>
                    </li>
                  ))}
                </ul>
                {d.totalSinCelo > d.sinCelo.length && <p className="mt-2 text-xs text-muted-foreground">Se muestran {d.sinCelo.length} de {d.totalSinCelo}.</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Dato({ titulo, valor, detalle }: { titulo: string; valor: ReactNode; detalle: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-bold tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{detalle}</p>
    </CardContent></Card>
  )
}
