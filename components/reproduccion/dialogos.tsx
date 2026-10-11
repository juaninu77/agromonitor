"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AnimalCombobox, type AnimalOpcion } from "./animal-combobox"
import { formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import {
  ETIQUETA_METODO_DESTETE, ETIQUETA_METODO_TACTO, ETIQUETA_RESULTADO_TACTO, ETIQUETA_TIPO_PARTO, ETIQUETA_TIPO_SERVICIO,
  METODOS_DESTETE, METODOS_TACTO, RESULTADOS_TACTO, TIPOS_PARTO, TIPOS_SERVICIO, TIPOS_TORADA,
} from "@/lib/reproduccion/validation"

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
export interface Opcion { id: string; nombre: string }

type ErrorConCodigo = Error & { codigo?: string }
async function enviar(url: string, body: Record<string, unknown>) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const b = await r.json().catch(() => ({}))
  if (!r.ok) { const e: ErrorConCodigo = new Error(b.error ?? "No se pudo guardar"); e.codigo = b.codigo; throw e }
  return b.data
}
/** Envía y, si el servidor pide confirmar (409 con código), pregunta y reintenta con la marca. */
async function enviarConfirmando(url: string, body: Record<string, unknown>, confirmaciones: Record<string, string> = {}) {
  try {
    return await enviar(url, body)
  } catch (e) {
    const campo = confirmaciones[(e as ErrorConCodigo).codigo ?? ""]
    if (campo && window.confirm((e as Error).message)) return enviar(url, { ...body, [campo]: true })
    throw e
  }
}

function Campo({ id, label, children, className }: { id?: string; label: string; children: ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ""}`}><Label htmlFor={id}>{label}</Label>{children}</div>
}

/** Diálogo base: guarda, muestra el error y cierra al terminar. */
function DialogoRegistro({ open, onOpenChange, titulo, descripcion, textoBoton, enviando, error, onGuardar, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; titulo: string; descripcion: string; textoBoton: string
  enviando: boolean; error: string; onGuardar: () => void; children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[540px]">
        <DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>{descripcion}</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); onGuardar() }}>
          {children}
          {error && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
            <Button type="submit" disabled={enviando}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{textoBoton}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Estado común de los diálogos: formulario, envío y error. */
function useRegistro<T extends object>(open: boolean, inicial: () => T) {
  const [form, setForm] = useState<T>(inicial)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { if (open) { setForm(inicial()); setError("") } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<T>) => setForm((f) => ({ ...f, ...patch }))
  async function guardar(accion: () => Promise<unknown>, ok: string, cerrar: () => void) {
    setEnviando(true); setError("")
    try { await accion(); toast.success(ok); cerrar() } catch (e) {
      const m = e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sin conexión: no se guardó"
      setError(m)
    } finally { setEnviando(false) }
  }
  return { form, set, enviando, error, setError, guardar }
}

interface PropsDialogo { open: boolean; onOpenChange: (o: boolean) => void; estId: string; onSuccess: () => void }

export function ServicioDialog({ open, onOpenChange, estId, onSuccess }: PropsDialogo) {
  const r = useRegistro(open, () => ({ fecha: hoyArgentina(), tipo: "natural", hembra: null as AnimalOpcion | null, macho: null as AnimalOpcion | null, toradaId: "", toroNombre: "", loteSemen: "", inseminador: "", observ: "" }))
  const { form, set } = r
  const toradas = useQuery({
    queryKey: ["repro-toradas-activas", estId],
    queryFn: async () => { const res = await fetch(`/api/reproduccion/toradas?establecimientoId=${estId}&activa=true&limit=100`); const b = await res.json(); return (b.data ?? []) as Opcion[] },
    enabled: open && !!estId,
  })
  const natural = form.tipo === "natural"
  function guardar() {
    if (!form.hembra) return r.setError("Elegí la hembra")
    void r.guardar(() => enviarConfirmando("/api/reproduccion/servicios", {
      fecha: form.fecha, tipo: form.tipo, hembraId: form.hembra!.id, toradaId: form.toradaId || null, observ: form.observ,
      // Monta natural: macho del rodeo; IA/IATF: toro (semen), pajuela e inseminador
      ...(natural ? { machoId: form.macho?.id ?? null } : { toroNombre: form.toroNombre, loteSemen: form.loteSemen, inseminador: form.inseminador }),
    }, { prenada: "aceptarPrenada" }), "Servicio registrado", () => { onOpenChange(false); onSuccess() })
  }
  return (
    <DialogoRegistro open={open} onOpenChange={onOpenChange} titulo="Nuevo servicio" descripcion="Monta natural, IA o IATF de una hembra." textoBoton="Registrar servicio" enviando={r.enviando} error={r.error} onGuardar={guardar}>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="sv-fecha" label="Fecha *"><Input id="sv-fecha" type="date" max={hoyArgentina()} value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} required /></Campo>
        <Campo id="sv-tipo" label="Tipo *">
          <select id="sv-tipo" className={selectClass} value={form.tipo} onChange={(e) => set({ tipo: e.target.value, macho: null, toroNombre: "", loteSemen: "", inseminador: "" })}>
            {TIPOS_SERVICIO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_SERVICIO[t]}</option>)}
          </select>
        </Campo>
      </div>
      <Campo id="sv-hembra" label="Hembra *"><AnimalCombobox id="sv-hembra" estId={estId} sexo="F" value={form.hembra} onChange={(a) => set({ hembra: a, macho: null })} placeholder="Buscar hembra" /></Campo>
      {natural ? (
        <Campo id="sv-macho" label="Macho">
          <AnimalCombobox id="sv-macho" estId={estId} sexo="M" especieId={form.hembra?.especieId} value={form.macho} onChange={(a) => set({ macho: a })} placeholder={form.hembra ? "Buscar macho (opcional)" : "Elegí primero la hembra"} disabled={!form.hembra} />
        </Campo>
      ) : (
        <>
          <Campo id="sv-toro" label="Toro (semen)"><Input id="sv-toro" maxLength={120} value={form.toroNombre} onChange={(e) => set({ toroNombre: e.target.value })} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="sv-pajuela" label="Partida de semen"><Input id="sv-pajuela" maxLength={60} value={form.loteSemen} onChange={(e) => set({ loteSemen: e.target.value })} /></Campo>
            <Campo id="sv-insem" label="Inseminador"><Input id="sv-insem" maxLength={120} value={form.inseminador} onChange={(e) => set({ inseminador: e.target.value })} /></Campo>
          </div>
        </>
      )}
      <Campo id="sv-torada" label="Torada">
        <select id="sv-torada" className={selectClass} value={form.toradaId} onChange={(e) => set({ toradaId: e.target.value })}>
          <option value="">Sin torada</option>{(toradas.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </Campo>
      <Campo id="sv-obs" label="Observaciones"><Textarea id="sv-obs" rows={2} maxLength={1000} value={form.observ} onChange={(e) => set({ observ: e.target.value })} /></Campo>
    </DialogoRegistro>
  )
}

export function TactoDialog({ open, onOpenChange, estId, onSuccess }: PropsDialogo) {
  const r = useRegistro(open, () => ({ fecha: hoyArgentina(), resultado: "preñada", metodo: "palpacion", hembra: null as AnimalOpcion | null, servicioId: "", mesesGest: "", fechaProbableParto: "", veterinario: "", observ: "" }))
  const { form, set } = r
  // Servicios sin tacto de la hembra elegida (para vincular el diagnóstico)
  const servicios = useQuery({
    queryKey: ["repro-servicios-sin-tacto", estId, form.hembra?.id],
    queryFn: async () => {
      const res = await fetch(`/api/reproduccion/servicios?establecimientoId=${estId}&hembraId=${form.hembra!.id}&sinTacto=true&limit=20`)
      const b = await res.json()
      return (b.data ?? []) as { id: string; fecha: string; tipo: string; torada: { nombre: string } | null }[]
    },
    enabled: open && !!form.hembra,
  })
  const prenada = form.resultado === "preñada"
  function guardar() {
    if (!form.hembra) return r.setError("Elegí la hembra")
    void r.guardar(() => enviar("/api/reproduccion/tactos", {
      fecha: form.fecha, resultado: form.resultado, metodo: form.metodo, hembraId: form.hembra!.id, servicioId: form.servicioId || null,
      mesesGest: prenada ? form.mesesGest : null, fechaProbableParto: prenada ? form.fechaProbableParto : null, veterinario: form.veterinario, observ: form.observ,
    }), "Tacto registrado", () => { onOpenChange(false); onSuccess() })
  }
  return (
    <DialogoRegistro open={open} onOpenChange={onOpenChange} titulo="Registrar tacto" descripcion="Diagnóstico de preñez de una hembra." textoBoton="Registrar tacto" enviando={r.enviando} error={r.error} onGuardar={guardar}>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="tc-fecha" label="Fecha *"><Input id="tc-fecha" type="date" max={hoyArgentina()} value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} required /></Campo>
        <Campo id="tc-res" label="Resultado *">
          <select id="tc-res" className={selectClass} value={form.resultado} onChange={(e) => set({ resultado: e.target.value })}>
            {RESULTADOS_TACTO.map((t) => <option key={t} value={t}>{ETIQUETA_RESULTADO_TACTO[t]}</option>)}
          </select>
        </Campo>
      </div>
      <Campo id="tc-hembra" label="Hembra *"><AnimalCombobox id="tc-hembra" estId={estId} sexo="F" value={form.hembra} onChange={(a) => set({ hembra: a, servicioId: "" })} placeholder="Buscar hembra" /></Campo>
      <Campo id="tc-serv" label="Servicio que se diagnostica">
        <select id="tc-serv" className={selectClass} value={form.servicioId} onChange={(e) => set({ servicioId: e.target.value })} disabled={!form.hembra}>
          <option value="">{!form.hembra ? "Elegí primero la hembra" : servicios.data?.length ? "Sin vincular" : "No tiene servicios sin tacto"}</option>
          {(servicios.data ?? []).map((s) => <option key={s.id} value={s.id}>{formatoDia(s.fecha)} · {ETIQUETA_TIPO_SERVICIO[s.tipo as keyof typeof ETIQUETA_TIPO_SERVICIO] ?? s.tipo}{s.torada ? ` · ${s.torada.nombre}` : ""}</option>)}
        </select>
      </Campo>
      <Campo id="tc-metodo" label="Método">
        <select id="tc-metodo" className={selectClass} value={form.metodo} onChange={(e) => set({ metodo: e.target.value })}>
          {METODOS_TACTO.map((m) => <option key={m} value={m}>{ETIQUETA_METODO_TACTO[m]}</option>)}
        </select>
      </Campo>
      {prenada && (
        <div className="grid grid-cols-2 gap-3">
          <Campo id="tc-meses" label="Meses de gestación"><Input id="tc-meses" type="number" inputMode="decimal" min="0.5" max="10" step="0.5" value={form.mesesGest} onChange={(e) => set({ mesesGest: e.target.value })} /></Campo>
          <Campo id="tc-fpp" label="Fecha probable de parto"><Input id="tc-fpp" type="date" min={form.fecha} value={form.fechaProbableParto} onChange={(e) => set({ fechaProbableParto: e.target.value })} /></Campo>
        </div>
      )}
      <Campo id="tc-vet" label="Veterinario"><Input id="tc-vet" maxLength={120} value={form.veterinario} onChange={(e) => set({ veterinario: e.target.value })} /></Campo>
      <Campo id="tc-obs" label="Observaciones"><Textarea id="tc-obs" rows={2} maxLength={1000} value={form.observ} onChange={(e) => set({ observ: e.target.value })} /></Campo>
    </DialogoRegistro>
  )
}

export function ParicionDialog({ open, onOpenChange, estId, onSuccess }: PropsDialogo) {
  const r = useRegistro(open, () => ({ fecha: hoyArgentina(), resultado: "vivo", madre: null as AnimalOpcion | null, padre: null as AnimalOpcion | null, padreExterno: "", pesoNacerKg: "", tipoParto: "", sexoCria: "", dificultad: "", observ: "" }))
  const { form, set } = r
  function guardar() {
    if (!form.madre) return r.setError("Elegí la madre")
    void r.guardar(() => enviarConfirmando("/api/reproduccion/pariciones", {
      fecha: form.fecha, resultado: form.resultado, madreId: form.madre!.id, padreId: form.padre?.id ?? null, padreExterno: form.padre ? null : form.padreExterno,
      pesoNacerKg: form.pesoNacerKg, tipoParto: form.tipoParto, sexoCria: form.sexoCria, dificultad: form.dificultad, observ: form.observ,
    }, { mellizo: "confirmarMellizo" }), "Parto registrado", () => { onOpenChange(false); onSuccess() })
  }
  return (
    <DialogoRegistro open={open} onOpenChange={onOpenChange} titulo="Registrar parto" descripcion="Un parto por cría: los mellizos se cargan como dos partos del mismo día." textoBoton="Registrar parto" enviando={r.enviando} error={r.error} onGuardar={guardar}>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="pa-fecha" label="Fecha *"><Input id="pa-fecha" type="date" max={hoyArgentina()} value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} required /></Campo>
        <Campo id="pa-res" label="Cría *">
          <select id="pa-res" className={selectClass} value={form.resultado} onChange={(e) => set({ resultado: e.target.value })}><option value="vivo">Nació viva</option><option value="muerto">Nació muerta</option></select>
        </Campo>
      </div>
      <Campo id="pa-madre" label="Madre *"><AnimalCombobox id="pa-madre" estId={estId} sexo="F" value={form.madre} onChange={(a) => set({ madre: a, padre: null })} placeholder="Buscar madre" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="pa-padre" label="Padre del rodeo">
          <AnimalCombobox id="pa-padre" estId={estId} sexo="M" especieId={form.madre?.especieId} value={form.padre} onChange={(a) => set({ padre: a, padreExterno: "" })} placeholder={form.madre ? "Opcional" : "Elegí la madre"} disabled={!form.madre} />
        </Campo>
        <Campo id="pa-externo" label="Padre externo (IA)"><Input id="pa-externo" maxLength={120} placeholder="Nombre del toro" value={form.padreExterno} disabled={!!form.padre} onChange={(e) => set({ padreExterno: e.target.value })} /></Campo>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Campo id="pa-peso" label="Peso al nacer (kg)"><Input id="pa-peso" type="number" inputMode="decimal" min="0" max="100" step="0.1" value={form.pesoNacerKg} onChange={(e) => set({ pesoNacerKg: e.target.value })} /></Campo>
        <Campo id="pa-sexo" label="Sexo de la cría">
          <select id="pa-sexo" className={selectClass} value={form.sexoCria} onChange={(e) => set({ sexoCria: e.target.value })}><option value="">—</option><option value="M">Macho</option><option value="F">Hembra</option></select>
        </Campo>
        <Campo id="pa-tipo" label="Tipo de parto">
          <select id="pa-tipo" className={selectClass} value={form.tipoParto} onChange={(e) => set({ tipoParto: e.target.value })}><option value="">—</option>{TIPOS_PARTO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_PARTO[t]}</option>)}</select>
        </Campo>
      </div>
      <Campo id="pa-dif" label="Dificultad (1 = sin ayuda, 5 = muy difícil)">
        <select id="pa-dif" className={selectClass} value={form.dificultad} onChange={(e) => set({ dificultad: e.target.value })}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </Campo>
      <Campo id="pa-obs" label="Observaciones"><Textarea id="pa-obs" rows={2} maxLength={1000} value={form.observ} onChange={(e) => set({ observ: e.target.value })} /></Campo>
    </DialogoRegistro>
  )
}

export function DesteteDialog({ open, onOpenChange, estId, lotes, onSuccess }: PropsDialogo & { lotes: Opcion[] }) {
  const r = useRegistro(open, () => ({ fecha: hoyArgentina(), animal: null as AnimalOpcion | null, pesoKg: "", edadDias: "", metodo: "", loteDesteteId: "", observ: "" }))
  const { form, set } = r
  function guardar() {
    if (!form.animal) return r.setError("Elegí el animal")
    void r.guardar(() => enviar("/api/reproduccion/destetes", {
      fecha: form.fecha, animalId: form.animal!.id, pesoKg: form.pesoKg, edadDias: form.edadDias, metodo: form.metodo, loteDesteteId: form.loteDesteteId || null, observ: form.observ,
    }), "Destete registrado", () => { onOpenChange(false); onSuccess() })
  }
  return (
    <DialogoRegistro open={open} onOpenChange={onOpenChange} titulo="Registrar destete" descripcion="Destete de un ternero o cordero." textoBoton="Registrar destete" enviando={r.enviando} error={r.error} onGuardar={guardar}>
      <Campo id="de-fecha" label="Fecha *"><Input id="de-fecha" type="date" max={hoyArgentina()} value={form.fecha} onChange={(e) => set({ fecha: e.target.value })} required /></Campo>
      <Campo id="de-animal" label="Animal *"><AnimalCombobox id="de-animal" estId={estId} value={form.animal} onChange={(a) => set({ animal: a })} placeholder="Buscar ternero o cordero" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="de-peso" label="Peso (kg)"><Input id="de-peso" type="number" inputMode="decimal" min="0" step="0.1" value={form.pesoKg} onChange={(e) => set({ pesoKg: e.target.value })} /></Campo>
        <Campo id="de-edad" label="Edad (días)"><Input id="de-edad" type="number" min="1" step="1" placeholder="Se calcula si tiene nacimiento" value={form.edadDias} onChange={(e) => set({ edadDias: e.target.value })} /></Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="de-metodo" label="Método">
          <select id="de-metodo" className={selectClass} value={form.metodo} onChange={(e) => set({ metodo: e.target.value })}><option value="">—</option>{METODOS_DESTETE.map((m) => <option key={m} value={m}>{ETIQUETA_METODO_DESTETE[m]}</option>)}</select>
        </Campo>
        <Campo id="de-grupo" label="Grupo de destete">
          <select id="de-grupo" className={selectClass} value={form.loteDesteteId} onChange={(e) => set({ loteDesteteId: e.target.value })}><option value="">—</option>{lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select>
        </Campo>
      </div>
      <Campo id="de-obs" label="Observaciones"><Textarea id="de-obs" rows={2} maxLength={1000} value={form.observ} onChange={(e) => set({ observ: e.target.value })} /></Campo>
    </DialogoRegistro>
  )
}

export function ToradaDialog({ open, onOpenChange, lotes, onSuccess }: Omit<PropsDialogo, "estId"> & { lotes: Opcion[] }) {
  const r = useRegistro(open, () => ({ nombre: "", loteId: "", tipo: "natural", fechaInicio: hoyArgentina(), fechaFin: "", cantidadHembras: "", cantidadMachos: "", observ: "" }))
  const { form, set } = r
  function guardar() {
    if (!form.loteId) return r.setError("Elegí el grupo")
    void r.guardar(() => enviar("/api/reproduccion/toradas", { ...form, fechaFin: form.fechaFin || null }), "Torada creada", () => { onOpenChange(false); onSuccess() })
  }
  return (
    <DialogoRegistro open={open} onOpenChange={onOpenChange} titulo="Nueva torada" descripcion="Temporada de servicio de un grupo de hembras." textoBoton="Crear torada" enviando={r.enviando} error={r.error} onGuardar={guardar}>
      <Campo id="to-nombre" label="Nombre *"><Input id="to-nombre" maxLength={120} placeholder="Servicio otoño 2026" value={form.nombre} onChange={(e) => set({ nombre: e.target.value })} required /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="to-grupo" label="Grupo de hembras *">
          <select id="to-grupo" className={selectClass} value={form.loteId} onChange={(e) => set({ loteId: e.target.value })}><option value="">Elegir grupo</option>{lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select>
        </Campo>
        <Campo id="to-tipo" label="Tipo *">
          <select id="to-tipo" className={selectClass} value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>{TIPOS_TORADA.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_SERVICIO[t]}</option>)}</select>
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="to-inicio" label="Inicio *"><Input id="to-inicio" type="date" value={form.fechaInicio} onChange={(e) => set({ fechaInicio: e.target.value })} required /></Campo>
        <Campo id="to-fin" label="Fin"><Input id="to-fin" type="date" min={form.fechaInicio} value={form.fechaFin} onChange={(e) => set({ fechaFin: e.target.value })} /></Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="to-hembras" label="Cantidad de hembras"><Input id="to-hembras" type="number" min="1" step="1" value={form.cantidadHembras} onChange={(e) => set({ cantidadHembras: e.target.value })} /></Campo>
        <Campo id="to-machos" label="Cantidad de machos"><Input id="to-machos" type="number" min="1" step="1" value={form.cantidadMachos} onChange={(e) => set({ cantidadMachos: e.target.value })} /></Campo>
      </div>
      <Campo id="to-obs" label="Observaciones"><Textarea id="to-obs" rows={2} maxLength={1000} value={form.observ} onChange={(e) => set({ observ: e.target.value })} /></Campo>
    </DialogoRegistro>
  )
}
