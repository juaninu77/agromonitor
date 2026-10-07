"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { Position } from "@/lib/mapa/geometry"
import type { VersionLimite } from "@/lib/mapa/historial"
import type { MapSector } from "@/lib/mapa/types"

const fecha = (s: string) => new Date(s).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" })
const ha = (n: number | null) => (n == null ? "" : `${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ha`)
const MOTIVO = { edicion: "Edición", division: "División", original: "Límite original" }

const verticesDe = (v: VersionLimite): Position[] | null => (v.geometria.type === "Polygon" ? v.geometria.coordinates[0].slice(0, -1) : null)

/** Versiones anteriores del límite: ver en el mapa y restaurar (crea una versión nueva). */
export function SectorHistorial({ sector, canEdit, onVer }: { sector: MapSector; canEdit: boolean; onVer: (limite: { vertices: Position[]; etiqueta: string } | null) => void }) {
  const client = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [viendo, setViendo] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState<string | null>(null)
  const query = useQuery<VersionLimite[]>({
    queryKey: ["historial-limites", sector.id, sector.version],
    enabled: abierto,
    queryFn: async () => {
      const r = await fetch(`/api/sectores/${sector.id}/historial`)
      const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? "No se pudo cargar el historial")
      return b.data
    },
  })

  function ver(v: VersionLimite) {
    const vertices = verticesDe(v)
    if (!vertices || viendo === v.id) { setViendo(null); onVer(null); return }
    setViendo(v.id)
    onVer({ vertices, etiqueta: `${MOTIVO[v.motivo]} · ${fecha(v.fecha)}` })
  }

  async function restaurar(v: VersionLimite) {
    if (!window.confirm(`¿Volver al límite del ${fecha(v.fecha)}${v.areaHa != null ? ` (${ha(v.areaHa)})` : ""}? El límite actual queda en el historial.`)) return
    setRestaurando(v.id)
    try {
      const r = await fetch(`/api/sectores/${sector.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: sector.version, geometria: v.geometria }) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? "No se pudo restaurar")
      setViendo(null); onVer(null)
      await Promise.all(["mapa", "sectores", "historial-limites"].map((k) => client.invalidateQueries({ queryKey: [k] })))
      toast.success("Límite restaurado")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo restaurar")
    } finally {
      setRestaurando(null)
    }
  }

  return (
    <details className="rounded-lg border p-3 text-sm" onToggle={(e) => { const open = (e.target as HTMLDetailsElement).open; setAbierto(open); if (!open) { setViendo(null); onVer(null) } }}>
      <summary className="cursor-pointer font-medium">Historial de límites</summary>
      {query.isPending && abierto ? <p className="mt-2 text-muted-foreground">Cargando…</p> : query.isError ? <p role="alert" className="mt-2 text-destructive">{query.error.message}</p> : !query.data?.length ? (
        <p className="mt-2 text-muted-foreground">Todavía no hay cambios de límite registrados.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {query.data.map((v) => (
            <li key={v.id} className="rounded-md border p-2">
              <p><strong>{MOTIVO[v.motivo]}</strong> · {fecha(v.fecha)}{v.autor ? ` · ${v.autor}` : ""}</p>
              <p className="text-xs text-muted-foreground">{v.geometria.type === "Polygon" ? ha(v.areaHa) : v.geometria.type === "Point" ? "Punto" : "Línea"}{v.actual ? " · vigente" : ""}</p>
              {!v.actual && (
                <div className="mt-1 flex gap-2">
                  {verticesDe(v) && <Button size="sm" variant="outline" onClick={() => ver(v)}>{viendo === v.id ? "Ocultar" : "Ver en el mapa"}</Button>}
                  {canEdit && <Button size="sm" variant="ghost" disabled={restaurando === v.id} onClick={() => restaurar(v)}>{restaurando === v.id ? "Restaurando…" : "Restaurar"}</Button>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}
