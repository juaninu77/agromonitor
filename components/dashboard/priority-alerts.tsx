"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ArrowRight, Droplets, Gauge, Sprout } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { alertasDelCampo, type Alerta } from "@/lib/mapa/capas"
import type { MapSector } from "@/lib/mapa/types"

const ICONO: Record<Alerta["tipo"], typeof Droplets> = { agua: Droplets, sobrecarga: Gauge, pasto: Sprout }
const TITULO: Record<Alerta["tipo"], string> = { agua: "Agua", sobrecarga: "Sobrecarga", pasto: "Pasto bajo" }

/**
 * Alertas del campo para el Panel de Control: las mismas que el resumen del
 * mapa de potreros (agua, sobrecarga y pasto bajo), con acceso directo al lugar.
 */
export function PriorityAlerts({ establecimientoId }: { establecimientoId: string }) {
  const query = useQuery({
    queryKey: ["mapa", establecimientoId],
    queryFn: async () => {
      const r = await fetch(`/api/mapa?establecimientoId=${establecimientoId}`)
      const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? "No se pudo cargar el campo")
      return b as { data: MapSector[]; puedeEditar: boolean }
    },
    staleTime: 60_000,
  })
  const alertas = query.data ? alertasDelCampo(query.data.data) : []
  if (query.isPending || query.isError || alertas.length === 0) return null
  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-amber-900">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          Para revisar en el campo ({alertas.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-amber-200">
          {alertas.slice(0, 6).map((a) => {
            const Icono = ICONO[a.tipo]
            return (
              <li key={`${a.sectorId}-${a.tipo}`}>
                <Link href={`/potreros?vista=mapa&sector=${a.sectorId}`} className="flex items-center gap-3 py-2 text-sm hover:underline">
                  <Icono className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                  <span className="min-w-0 flex-1"><strong>{a.nombre}</strong> · {TITULO[a.tipo]}: {a.texto}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
        {alertas.length > 6 && (
          <Link href="/potreros?vista=mapa" className="mt-2 inline-block text-sm font-medium text-amber-900 underline">Ver todas en el mapa</Link>
        )}
      </CardContent>
    </Card>
  )
}
