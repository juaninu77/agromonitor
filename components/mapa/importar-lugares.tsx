"use client"

import { useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { FileUp, Loader2, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { areaHa, SECTOR_TYPES } from "@/lib/mapa/geometry"
import { formatearDistancia, largoM } from "@/lib/mapa/drawing"
import { importarArchivoMapa, MAX_LUGARES, nombresLibres, tipoCompatible, type ImportedPlace, type Omitido } from "@/lib/mapa/import"

/** Figura del archivo en revisión (todavía no guardada). */
export interface FiguraImportada extends ImportedPlace { key: string; incluido: boolean }

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 })
const medida = (f: ImportedPlace) =>
  f.geometry.type === "Polygon" ? `${fmt(areaHa(f.geometry)!)} ha` : f.geometry.type === "LineString" ? formatearDistancia(largoM(f.geometry.coordinates)) : "punto"
const selectClass = "h-8 w-full rounded-md border bg-background px-2 text-xs"

interface Props {
  fieldId: string
  /** Nombres de los lugares del campo (para avisar los repetidos) */
  nombresExistentes: string[]
  disabled: boolean
  figuras: FiguraImportada[]
  onFiguras: (figuras: FiguraImportada[], nuevoArchivo?: boolean) => void
  /** Abre una figura en el editor del mapa para ajustarla y guardarla sola */
  onEditar: (figura: FiguraImportada) => void
}

/**
 * Importar lugares de Google Earth (KMZ/KML) o GeoJSON: se leen en el dispositivo, se
 * muestran en el mapa con el tipo deducido y se crean todos juntos con «Crear N lugares».
 */
export function ImportarLugares({ fieldId, nombresExistentes, disabled, figuras, onFiguras, onEditar }: Props) {
  const client = useQueryClient()
  const [error, setError] = useState(""), [avisos, setAvisos] = useState<string[]>([]), [omitidos, setOmitidos] = useState<Omitido[]>([])
  const [archivo, setArchivo] = useState(""), [leyendo, setLeyendo] = useState(false), [creando, setCreando] = useState(false)
  // Una clave por archivo: si se corta la conexión y se reintenta, no se crean dos veces
  const clave = useRef<string>("")

  const elegidas = figuras.filter((f) => f.incluido)
  const nombresFinales = useMemo(() => nombresLibres(elegidas.map((f) => f.nombre.trim()), nombresExistentes), [elegidas, nombresExistentes])
  const renombre = new Map(elegidas.map((f, i) => [f.key, nombresFinales[i]]))

  async function leer(file: File) {
    setError(""); setAvisos([]); setOmitidos([]); setLeyendo(true)
    try {
      const r = await importarArchivoMapa(file)
      clave.current = crypto.randomUUID()
      setArchivo(file.name); setAvisos(r.avisos); setOmitidos(r.omitidos)
      onFiguras(r.lugares.map((l, i) => ({ ...l, key: `${i}-${l.nombre}`, incluido: true })), true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo")
    } finally { setLeyendo(false) }
  }

  const cambiar = (key: string, cambio: Partial<FiguraImportada>) => onFiguras(figuras.map((f) => (f.key === key ? { ...f, ...cambio } : f)))
  function descartar() { onFiguras([]); setArchivo(""); setAvisos([]); setOmitidos([]); setError("") }

  async function crear() {
    if (!elegidas.length) return
    const sinNombre = elegidas.find((f) => !f.nombre.trim())
    if (sinNombre) { toast.error("Cada lugar necesita un nombre"); return }
    setCreando(true)
    try {
      const res = await fetch("/api/sectores/importar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          establecimientoId: fieldId, clave: clave.current,
          lugares: elegidas.map((f) => ({ nombre: f.nombre.trim(), tipo: f.tipo, descripcion: f.descripcion, geometria: f.geometry })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "No se pudieron crear los lugares")
      const { creados, renombrados } = json.data as { creados: unknown[]; renombrados: { original: string; nombre: string }[] }
      await Promise.all([client.invalidateQueries({ queryKey: ["mapa", fieldId] }), client.invalidateQueries({ queryKey: ["sectores", fieldId] })])
      toast.success(`${creados.length} ${creados.length === 1 ? "lugar creado" : "lugares creados"} en el campo`, {
        description: renombrados.length ? `Con otro nombre porque ya existían: ${renombrados.map((r) => `«${r.nombre}»`).join(", ")}` : undefined,
      })
      // Quedan en la lista las que no se eligieron (se pueden crear después con otra clave)
      const resto = figuras.filter((f) => !f.incluido)
      clave.current = crypto.randomUUID()
      onFiguras(resto)
      if (!resto.length) { setArchivo(""); setAvisos([]); setOmitidos([]) }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron crear los lugares")
    } finally { setCreando(false) }
  }

  return (
    <div className="mt-3 space-y-2">
      {!figuras.length && (
        <label className="block text-xs text-muted-foreground">
          KMZ o KML de Google Earth, o GeoJSON · hasta 5 MB y {MAX_LUGARES} figuras. El tipo de cada lugar sale del nombre o la carpeta («Aguada norte», carpeta «Corrales»…).
          <Input type="file" accept=".kmz,.kml,.geojson,.json" aria-label="Archivo para importar" className="mt-1" disabled={disabled || leyendo}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void leer(file); e.target.value = "" }} />
        </label>
      )}
      {leyendo && <p role="status" className="flex items-center gap-2 text-xs"><Loader2 className="h-3 w-3 animate-spin" />Leyendo el archivo…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {figuras.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1 text-xs font-medium"><FileUp className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{archivo}</span></p>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={descartar} disabled={creando}><X className="mr-1 h-3 w-3" />Descartar</Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{elegidas.length} de {figuras.length} elegidos</span>
            <span className="flex gap-2">
              <button type="button" className="underline" onClick={() => onFiguras(figuras.map((f) => ({ ...f, incluido: true })))}>Todos</button>
              <button type="button" className="underline" onClick={() => onFiguras(figuras.map((f) => ({ ...f, incluido: false })))}>Ninguno</button>
            </span>
          </div>
          <ul className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
            {figuras.map((f) => {
              const final = renombre.get(f.key)
              return (
                <li key={f.key} className={`rounded-md border p-2 ${f.incluido ? "" : "opacity-60"}`}>
                  <div className="flex items-start gap-2">
                    <Checkbox checked={f.incluido} onCheckedChange={(v) => cambiar(f.key, { incluido: v === true })} aria-label={`Crear «${f.nombre}»`} className="mt-2" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Input value={f.nombre} maxLength={120} aria-label="Nombre del lugar" className="h-8 text-xs" onChange={(e) => cambiar(f.key, { nombre: e.target.value })} />
                      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                        <select aria-label="Tipo de lugar" className={selectClass} value={f.tipo} onChange={(e) => cambiar(f.key, { tipo: e.target.value, tipoDetectado: true })}>
                          {SECTOR_TYPES.filter(([t]) => tipoCompatible(t, f.geometry.type)).map(([t, label]) => <option key={t} value={t}>{label}</option>)}
                        </select>
                        <span className="text-[11px] text-muted-foreground">{medida(f)}</span>
                      </div>
                      {(f.carpeta || !f.tipoDetectado) && (
                        <p className="text-[11px] text-muted-foreground">
                          {f.carpeta && <>Carpeta «{f.carpeta}»{!f.tipoDetectado ? " · " : ""}</>}
                          {!f.tipoDetectado && <>tipo según la forma, revisalo</>}
                        </p>
                      )}
                      {f.incluido && final && final !== f.nombre.trim() && <p className="text-[11px] text-amber-700">Ya existe ese nombre: se guardará como «{final}».</p>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Editar en el mapa" aria-label={`Editar «${f.nombre}» en el mapa`} disabled={disabled || creando} onClick={() => onEditar(f)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
          <Button className="w-full" disabled={!elegidas.length || creando || disabled} onClick={crear}>
            {creando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear {elegidas.length} {elegidas.length === 1 ? "lugar" : "lugares"}
          </Button>
          <p className="text-[11px] text-muted-foreground">En el mapa se ven punteados. Revisá nombre y tipo; con el lápiz podés ajustar una figura y guardarla sola.</p>
        </>
      )}

      {omitidos.length > 0 && (
        <details className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          <summary className="cursor-pointer">{omitidos.length} {omitidos.length === 1 ? "figura no se pudo importar" : "figuras no se pudieron importar"}</summary>
          <ul className="mt-1 list-disc pl-4">{omitidos.map((o, i) => <li key={i}>«{o.nombre}»: {o.motivo}</li>)}</ul>
        </details>
      )}
      {avisos.length > 0 && <ul className="list-disc pl-4 text-xs text-amber-800">{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
    </div>
  )
}
