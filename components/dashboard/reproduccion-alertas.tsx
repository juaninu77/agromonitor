"use client"

import Link from "next/link"
import { ArrowRight, Heart } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAgenda } from "@/components/reproduccion/agenda-indicadores"
import { formatoDia } from "@/lib/inventario/fechas"

const MOSTRAR = 5

/** Pendientes reproductivos atrasados (tactos, partos, señaladas, destetes) para el Panel. */
export function ReproduccionAlertas({ establecimientoId }: { establecimientoId: string }) {
  const agenda = useAgenda(establecimientoId)
  const atrasados = (agenda.data ?? []).filter((p) => p.vencida)
  if (!atrasados.length) return null
  return (
    <Card className="border-amber-200 bg-amber-50/60 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Heart className="h-5 w-5 text-amber-700" aria-hidden />Reproducción: {atrasados.length} {atrasados.length === 1 ? "pendiente atrasado" : "pendientes atrasados"}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-amber-200">
          {atrasados.slice(0, MOSTRAR).map((p) => (
            <li key={p.clave}>
              <Link href="/reproduccion?tab=agenda" className="flex items-center gap-3 py-2 text-sm hover:underline">
                <span className="min-w-0 flex-1"><strong>{p.titulo}</strong><span className="text-muted-foreground"> · {p.detalle} · desde el {formatoDia(p.fecha)}</span></span>
                <ArrowRight className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/reproduccion?tab=agenda" className="mt-2 inline-block text-sm font-medium underline">Ver la agenda reproductiva</Link>
      </CardContent>
    </Card>
  )
}
