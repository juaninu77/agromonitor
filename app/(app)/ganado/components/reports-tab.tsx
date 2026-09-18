"use client"

import type { GanadoStats } from "@/lib/hooks/use-ganado"
import { CategoryDistributionChart } from "./charts/category-distribution-chart"
import { WeightByCategoryChart } from "./charts/weight-by-category-chart"

export function ReportsTab({
  stats,
  isLoading,
}: {
  stats: GanadoStats | null
  isLoading: boolean
}) {
  if (isLoading) return <p role="status">Cargando reportes…</p>
  if (!stats?.total)
    return (
      <p className="py-8 text-center text-muted-foreground">
        No hay animales para estos filtros.
      </p>
    )
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {stats.total} animales con los filtros actuales, incluyendo todas las
        páginas. El peso usa la última pesada registrada de {stats.conPeso}{" "}
        animales.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryDistributionChart
          data={Object.entries(stats.porCategoria).map(([name, value]) => ({
            name,
            value,
          }))}
        />
        <WeightByCategoryChart data={stats.pesoPorCategoria} />
      </div>
      <p className="text-xs text-muted-foreground">
        Para revisar tratamientos, reproducción y documentación, abrí la ficha
        de cada animal. Registrar una vacuna no equivale a una evaluación
        sanitaria completa.
      </p>
    </div>
  )
}
