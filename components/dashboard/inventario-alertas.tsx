"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, CalendarClock, PackageMinus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AlertasInventario } from "@/lib/inventario/alertas"

const num = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 3 })
const cuando = (d: number) => (d < 0 ? `venció hace ${-d} ${-d === 1 ? "día" : "días"}` : d === 0 ? "vence hoy" : `vence en ${d} ${d === 1 ? "día" : "días"}`)

/**
 * Alertas de insumos para el Panel de Control: productos en o debajo de su mínimo
 * y lotes con saldo vencidos o por vencer (30 días), con acceso al producto.
 */
export function InventarioAlertas({ establecimientoId }: { establecimientoId: string }) {
  const query = useQuery({
    queryKey: ["inventario-alertas", establecimientoId],
    queryFn: async () => {
      const r = await fetch(`/api/inventario/alertas?establecimientoId=${establecimientoId}`)
      const b = await r.json()
      if (!r.ok) throw new Error(b.error ?? "No se pudieron cargar las alertas")
      return b.data as AlertasInventario
    },
    staleTime: 60_000,
  })
  if (!query.data) return null
  const items = [
    ...query.data.vencimientos.map((v) => ({
      key: `v-${v.loteId}`, href: `/inventario/${v.productoId}?lote=${v.loteId}`, icono: CalendarClock, urgente: v.diasRestantes < 0,
      texto: <><strong>{v.nombre}</strong> · lote {v.nroLote} {cuando(v.diasRestantes)} ({num(v.saldo)} {v.unidad})</>,
    })),
    ...query.data.stockBajo.map((s) => ({
      key: `s-${s.productoId}`, href: `/inventario/${s.productoId}`, icono: PackageMinus, urgente: s.stock <= 0,
      texto: <><strong>{s.nombre}</strong> · {s.stock <= 0 ? "sin stock" : `quedan ${num(s.stock)} ${s.unidad}`} (mínimo {num(s.minimo)})</>,
    })),
  ]
  // Primero lo urgente (vencido o sin stock), manteniendo el orden de cada grupo
  items.sort((a, b) => Number(b.urgente) - Number(a.urgente))
  if (!items.length) return null
  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-amber-900">
          <PackageMinus className="h-5 w-5" aria-hidden />
          Insumos para revisar ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-amber-200">
          {items.slice(0, 6).map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="flex items-center gap-3 py-2 text-sm hover:underline">
                <i.icono className={`h-4 w-4 shrink-0 ${i.urgente ? "text-destructive" : "text-amber-700"}`} aria-hidden />
                <span className="min-w-0 flex-1">{i.texto}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        {items.length > 6 && <Link href="/inventario" className="mt-2 inline-block text-sm font-medium text-amber-900 underline">Ver todo el inventario</Link>}
      </CardContent>
    </Card>
  )
}
