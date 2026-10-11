"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, Syringe } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { diasEntre, formatoDia, hoyArgentina } from "@/lib/inventario/fechas"
import type { TareaPlan } from "@/components/sanidad/plan-tab"

const MOSTRAR = 5

/**
 * Tareas del plan sanitario vencidas sin registrar, para el Panel de Control: cada una
 * lleva a Sanidad con la tarea abierta para registrarla.
 */
export function SanidadAlertas({ establecimientoId }: { establecimientoId: string }) {
  const query = useQuery({
    queryKey: ["sanidad", "plan", establecimientoId, "vencidas"],
    queryFn: async () => {
      const r = await fetch(`/api/sanidad/plan?establecimientoId=${establecimientoId}&estado=vencidas&limite=100`)
      const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? "No se pudieron cargar las tareas sanitarias")
      return b.data as TareaPlan[]
    },
    staleTime: 60_000,
  })
  const tareas = query.data ?? []
  if (!tareas.length) return null
  const hoy = hoyArgentina()
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Syringe className="h-5 w-5 text-destructive" aria-hidden />
          Plan sanitario: {tareas.length === 100 ? "100 o más" : tareas.length} {tareas.length === 1 ? "tarea vencida" : "tareas vencidas"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-destructive/20">
          {tareas.slice(0, MOSTRAR).map((t) => {
            const atraso = t.fecha ? diasEntre(t.fecha, hoy) : null
            return (
              <li key={t.id}>
                <Link href={`/sanidad?tarea=${t.id}`} className="flex items-center gap-3 py-2 text-sm hover:underline">
                  <span className="min-w-0 flex-1">
                    <strong>{t.titulo}</strong>
                    {t.fecha && <span className="text-muted-foreground"> · {formatoDia(t.fecha)}{atraso ? ` (hace ${atraso} ${atraso === 1 ? "día" : "días"})` : ""}</span>}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
        <Link href="/sanidad" className="mt-2 inline-block text-sm font-medium underline">Ver el plan sanitario</Link>
      </CardContent>
    </Card>
  )
}
