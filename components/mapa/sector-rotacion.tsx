"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatearEv, textoEspecies } from "@/lib/mapa/carga"
import { medicionVigente } from "@/lib/mapa/capas"
import type { MapSector } from "@/lib/mapa/types"

interface PastoreoHist {
  id: string
  lote: { id: string; nombre: string; especie: { nombre: string } }
  ingreso: string
  egreso: string | null
  animales: number | null
  dias: number
  descansoPrevio: number | null
  abierto: boolean
}
interface Medicion {
  id: string
  fecha: string
  alturaPastoCm: number | null
  msKgHa: number | null
  coberturaPct: number | null
  observ: string | null
}

const fecha = (s: string) => new Date(s).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
const chartConfig = { altura: { label: "Altura (cm)", color: "hsl(var(--chart-2))" } } satisfies ChartConfig

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url)
  const b = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(b.error ?? "No se pudo cargar")
  return b.data as T
}

/** Pestaña "Rotación y pasto": ocupación actual, historial de pastoreos y mediciones. */
export function SectorRotacion({ sector, canEdit }: { sector: MapSector; canEdit: boolean }) {
  const client = useQueryClient()
  const pastoreos = useQuery({ queryKey: ["pastoreos-sector", sector.id], queryFn: () => json<PastoreoHist[]>(`/api/sectores/${sector.id}/pastoreos`) })
  const mediciones = useQuery({ queryKey: ["mediciones", sector.id], queryFn: () => json<Medicion[]>(`/api/sectores/${sector.id}/mediciones?limit=60`) })
  const [salida, setSalida] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<string | null>(null)

  async function registrarSalida(p: PastoreoHist) {
    setGuardando(p.id)
    try {
      const r = await fetch(`/api/pastoreo/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ egreso: salida[p.id] ?? hoy() }) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error ?? "No se pudo registrar la salida")
      await Promise.all(["pastoreos-sector", "mapa", "sectores"].map((k) => client.invalidateQueries({ queryKey: [k] })))
      toast.success(`Salida de ${p.lote.nombre} registrada`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la salida")
    } finally {
      setGuardando(null)
    }
  }

  const serie = (mediciones.data ?? []).filter((m) => m.alturaPastoCm != null).slice().reverse()
    .map((m) => ({ fecha: fecha(m.fecha), altura: m.alturaPastoCm }))
  const ultima = sector.ultimaMedicion

  return (
    <div className="space-y-4 text-sm">
      <section className="rounded-lg border p-3">
        <h3 className="mb-1 font-medium">Situación actual</h3>
        {sector.animales > 0 ? (
          <p>
            Ocupado {sector.diasOcupacion != null ? <>hace <strong>{sector.diasOcupacion} días</strong></> : ""} · {textoEspecies(sector.porEspecie)} · {formatearEv(sector.ev)} EV
            {sector.evHa != null && <> ({formatearEv(sector.evHa)} EV/ha)</>}
          </p>
        ) : sector.diasDescanso != null ? (
          <p>Sin animales: <strong>{sector.diasDescanso} días de descanso</strong> desde el {fecha(sector.ultimaSalida!)}.</p>
        ) : (
          <p className="text-muted-foreground">Sin animales ni salidas registradas.</p>
        )}
        {sector.pastoreosIngreso.length > 0 && <p className="mt-1">Grupos: {sector.pastoreosIngreso.map((p) => p.lote.nombre).join(", ")}</p>}
        {ultima && (
          <p className={`mt-1 ${medicionVigente(sector) ? "" : "text-muted-foreground"}`}>
            Última medición: {fecha(ultima.fecha)} · {ultima.alturaPastoCm ?? "—"} cm{ultima.msKgHa != null ? ` · ${ultima.msKgHa.toLocaleString("es-AR")} kg MS/ha` : ""}
            {!medicionVigente(sector) && " (desactualizada)"}
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-medium">Historial de pastoreos</h3>
        {pastoreos.isPending ? <p role="status">Cargando…</p> : pastoreos.isError ? <p role="alert">{pastoreos.error.message}</p> : !pastoreos.data.length ? (
          <p className="text-muted-foreground">Todavía no hay pastoreos registrados. Se registran solos al ingresar un grupo completo.</p>
        ) : (
          <ol className="space-y-2">
            {pastoreos.data.map((p) => (
              <li key={p.id} className="rounded-lg border p-3">
                <p className="font-medium">{p.lote.nombre} <span className="font-normal text-muted-foreground">· {p.lote.especie.nombre}{p.animales ? ` · ${p.animales} animales` : ""}</span></p>
                <p>{fecha(p.ingreso)} → {p.egreso ? fecha(p.egreso) : <strong>en curso</strong>} · {p.dias} {p.dias === 1 ? "día" : "días"}</p>
                {p.descansoPrevio != null && <p className="text-xs text-muted-foreground">Descanso previo: {p.descansoPrevio} días</p>}
                {p.abierto && canEdit && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="date" aria-label={`Fecha de salida de ${p.lote.nombre}`} className="erp-select w-auto" max={hoy()} value={salida[p.id] ?? hoy()} onChange={(e) => setSalida((v) => ({ ...v, [p.id]: e.target.value }))} />
                    <Button size="sm" variant="outline" disabled={guardando === p.id} onClick={() => registrarSalida(p)}>{guardando === p.id ? "Guardando…" : "Registrar salida"}</Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-medium">Mediciones de pasto</h3>
        {serie.length >= 2 && (
          <ChartContainer config={chartConfig} className="mb-3 h-40 w-full">
            <LineChart data={serie} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.4} />
              <XAxis dataKey="fecha" tickLine={false} axisLine={false} fontSize={11} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={32} fontSize={11} unit=" cm" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line dataKey="altura" type="monotone" stroke="var(--color-altura)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        )}
        {mediciones.isPending ? <p role="status">Cargando…</p> : !mediciones.data?.length ? (
          <p className="text-muted-foreground">Sin mediciones. Registralas desde «Registrar actividad → Medición de pasto».</p>
        ) : (
          <table className="w-full text-xs">
            <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Fecha</th><th className="text-right font-normal">Altura</th><th className="text-right font-normal">kg MS/ha</th><th className="text-right font-normal">Cobertura</th></tr></thead>
            <tbody>
              {mediciones.data.slice(0, 12).map((m) => (
                <tr key={m.id} className="border-t"><td className="py-1">{fecha(m.fecha)}</td><td className="text-right tabular-nums">{m.alturaPastoCm != null ? `${m.alturaPastoCm} cm` : "—"}</td><td className="text-right tabular-nums">{m.msKgHa?.toLocaleString("es-AR") ?? "—"}</td><td className="text-right tabular-nums">{m.coberturaPct != null ? `${m.coberturaPct}%` : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
