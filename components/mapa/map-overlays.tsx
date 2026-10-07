"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, ChevronDown, ChevronUp, Droplets, Gauge, Sprout } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  alertasDelCampo,
  GRUPOS_CAPA,
  leyendaDeModo,
  MODOS_COLOR,
  resumenDelCampo,
  type ModoColor,
} from "@/lib/mapa/capas"
import { formatearEv, textoEspecies } from "@/lib/mapa/carga"
import { sectorLabel } from "@/lib/mapa/geometry"
import type { MapSector } from "@/lib/mapa/types"

const fmtHa = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 })

/** Contenido del popover "Capas": vista, colorear por, etiquetas y capas por tipo. */
export function CapasMapa({
  satellite, setSatellite, modo, setModo, etiquetas, setEtiquetas, ocultas, setOcultas, sectors,
}: {
  satellite: boolean; setSatellite: (v: boolean) => void
  modo: ModoColor; setModo: (m: ModoColor) => void
  etiquetas: boolean; setEtiquetas: (v: boolean) => void
  ocultas: string[]; setOcultas: (v: string[]) => void
  sectors: MapSector[]
}) {
  const cantidad = (tipos: readonly string[]) => sectors.filter((s) => s.geometria && tipos.includes(s.tipo)).length
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Fondo</h2>
        <div className="flex gap-2" role="group" aria-label="Fondo del mapa">
          <Button size="sm" variant={!satellite ? "default" : "outline"} aria-pressed={!satellite} onClick={() => setSatellite(false)}>Mapa</Button>
          <Button size="sm" variant={satellite ? "default" : "outline"} aria-pressed={satellite} onClick={() => setSatellite(true)}>Satélite</Button>
        </div>
      </section>
      <section className="space-y-1.5">
        <label htmlFor="map-modo" className="text-sm font-semibold">Colorear por</label>
        <select id="map-modo" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={modo} onChange={(e) => setModo(e.target.value as ModoColor)}>
          {MODOS_COLOR.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </section>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={etiquetas} onChange={(e) => setEtiquetas(e.target.checked)} />
        Mostrar nombres y ganado sobre el mapa
      </label>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-semibold">Capas</legend>
        {GRUPOS_CAPA.map((g) => (
          <label key={g.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!ocultas.includes(g.id)}
                onChange={(e) => setOcultas(e.target.checked ? ocultas.filter((o) => o !== g.id) : [...ocultas, g.id])}
              />
              {g.label}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{cantidad(g.tipos)}</span>
          </label>
        ))}
      </fieldset>
    </div>
  )
}

/** Leyenda flotante del modo de color actual (plegable). */
export function LeyendaMapa({ modo, sectors }: { modo: ModoColor; sectors: MapSector[] }) {
  const [abierta, setAbierta] = useState(true)
  const tipos = useMemo(() => [...new Set(sectors.filter((s) => s.geometria).map((s) => s.tipo))], [sectors])
  const items = leyendaDeModo(modo, tipos)
  if (!items.length) return null
  const titulo = MODOS_COLOR.find((m) => m.id === modo)?.label
  return (
    <section className="map-floating map-legend p-2 text-xs" aria-label={`Leyenda: ${titulo}`}>
      <button type="button" className="flex w-full items-center justify-between gap-2 font-semibold" aria-expanded={abierta} onClick={() => setAbierta((v) => !v)}>
        {titulo}
        {abierta ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronUp className="h-3.5 w-3.5" aria-hidden />}
      </button>
      {abierta && (
        <ul className="mt-1.5 space-y-1">
          {items.map((i) => (
            <li key={i.label} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/10" style={{ backgroundColor: i.color }} aria-hidden />
              {i.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const ICONO_ALERTA = { agua: Droplets, sobrecarga: Gauge, pasto: Sprout }

/** Resumen del campo con alertas que llevan al lugar. */
export function ResumenCampo({ sectors, onIr }: { sectors: MapSector[]; onIr: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const r = useMemo(() => resumenDelCampo(sectors), [sectors])
  const alertas = useMemo(() => alertasDelCampo(sectors), [sectors])
  return (
    <section className="map-floating map-summary text-sm" aria-label="Resumen del campo">
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
        <span className="min-w-0 flex-1 truncate">
          <strong>{r.animales}</strong> animales · <strong>{formatearEv(r.ev)}</strong> EV
          {r.cargaGlobal != null && <> · {formatearEv(r.cargaGlobal)} EV/ha</>}
        </span>
        {alertas.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {alertas.length}
          </span>
        )}
        {abierto ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronUp className="h-4 w-4" aria-hidden />}
      </button>
      {abierto && (
        <div className="max-h-[50vh] space-y-3 overflow-y-auto border-t px-3 py-2">
          {alertas.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Para revisar</h3>
              <ul className="space-y-1">
                {alertas.map((a) => {
                  const Icono = ICONO_ALERTA[a.tipo]
                  return (
                    <li key={`${a.sectorId}-${a.tipo}`}>
                      <button type="button" className="flex w-full items-start gap-2 rounded-md p-1.5 text-left hover:bg-muted" onClick={() => onIr(a.sectorId)}>
                        <Icono className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                        <span><strong>{a.nombre}</strong>: {a.texto}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Ganado</dt>
            <dd className="text-right">{textoEspecies(r.porEspecie) || "Sin animales ubicados"}</dd>
            <dt className="text-muted-foreground">Grupos pastoreando</dt>
            <dd className="text-right tabular-nums">{r.lotesEnPastoreo}</dd>
            <dt className="text-muted-foreground">Tareas pendientes</dt>
            <dd className="text-right tabular-nums">{r.pendientes}</dd>
            <dt className="text-muted-foreground">Lugares sin ubicar</dt>
            <dd className="text-right tabular-nums">{r.sinUbicar}</dd>
          </dl>
          {r.hectareasPorTipo.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Superficie</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground"><th className="text-left font-normal">Tipo</th><th className="text-right font-normal">Mapa</th><th className="text-right font-normal">Declarada</th></tr>
                </thead>
                <tbody>
                  {r.hectareasPorTipo.map((h) => (
                    <tr key={h.tipo}><td>{sectorLabel(h.tipo)}</td><td className="text-right tabular-nums">{fmtHa(h.mapaHa)} ha</td><td className="text-right tabular-nums">{h.declaradaHa ? `${fmtHa(h.declaradaHa)} ha` : "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">Carga en equivalentes vaca (EV) según la categoría. Imágenes de referencia; superficies aproximadas, no catastrales.</p>
        </div>
      )}
    </section>
  )
}

interface Archivado { id: string; nombre: string; tipo: string; version: number; updatedAt: string }

/** Lugares archivados del campo, con opción de restaurarlos (solo quien puede editar). */
export function LugaresArchivados({ fieldId, canEdit }: { fieldId: string; canEdit: boolean }) {
  const client = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [restaurando, setRestaurando] = useState<string | null>(null)
  const query = useQuery<Archivado[]>({
    queryKey: ["sectores-archivados", fieldId],
    enabled: abierto,
    queryFn: async () => {
      const r = await fetch(`/api/sectores/archivados?establecimientoId=${fieldId}`)
      const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? "No se pudieron cargar los archivados")
      return b.data
    },
  })
  async function restaurar(a: Archivado) {
    setRestaurando(a.id)
    try {
      const r = await fetch(`/api/sectores/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: a.version, activo: true }) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? "No se pudo restaurar")
      await Promise.all(["mapa", "sectores", "sectores-archivados"].map((k) => client.invalidateQueries({ queryKey: [k] })))
      toast.success(`«${a.nombre}» restaurado`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo restaurar")
    } finally {
      setRestaurando(null)
    }
  }
  return (
    <details className="border-t pt-3" onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-sm font-medium">Lugares archivados</summary>
      {query.isPending && abierto ? <p className="mt-2 text-xs text-muted-foreground">Cargando…</p> : query.isError ? <p role="alert" className="mt-2 text-sm text-destructive">{query.error.message}</p> : !query.data?.length ? (
        <p className="mt-2 text-xs text-muted-foreground">No hay lugares archivados.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {query.data.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{a.nombre} <span className="text-xs text-muted-foreground">· {sectorLabel(a.tipo)}</span></span>
              {canEdit && <Button size="sm" variant="outline" disabled={restaurando === a.id} onClick={() => restaurar(a)}>{restaurando === a.id ? "Restaurando…" : "Restaurar"}</Button>}
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
