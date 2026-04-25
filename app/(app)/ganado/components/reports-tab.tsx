"use client"

import { memo, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart3 } from "lucide-react"
import { CategoryDistributionChart } from "./charts/category-distribution-chart"
import { WeightByCategoryChart } from "./charts/weight-by-category-chart"
import { HealthStatsChart } from "./charts/health-stats-chart"

interface ReportsTabProps {
  animals: any[]
}

export const ReportsTab = memo(function ReportsTab({ animals }: ReportsTabProps) {
  const chartData = useMemo(() => {
    const categoryDistribution = Object.entries(
      animals.reduce((acc: Record<string, number>, animal) => {
        const category = animal.category || "Sin categoría"
        acc[category] = (acc[category] || 0) + 1
        return acc
      }, {})
    ).map(([name, value]) => ({ name, value }))

    const weightByCategory = Object.entries(
      animals.reduce((acc: Record<string, { total: number; count: number }>, animal) => {
        const category = animal.category || "Sin categoría"
        const weight = animal.weight || animal.pesoActual || 0
        if (!acc[category]) acc[category] = { total: 0, count: 0 }
        if (weight > 0) {
          acc[category].total += weight
          acc[category].count++
        }
        return acc
      }, {})
    )
      .map(([category, data]) => ({
        category,
        avgWeight: data.count > 0 ? Math.round(data.total / data.count) : 0,
        count: data.count,
      }))
      .filter((item) => item.count > 0)

    const healthStats = Object.entries(
      animals.reduce((acc: Record<string, number>, animal) => {
        const status = animal.healthStatus || "Saludable"
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})
    ).map(([status, count]) => ({ status, count }))

    return { categoryDistribution, weightByCategory, healthStats }
  }, [animals])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryDistributionChart data={chartData.categoryDistribution} />
        <WeightByCategoryChart data={chartData.weightByCategory} />
      </div>

      <HealthStatsChart data={chartData.healthStats} />

      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Reportes Interactivos en Tiempo Real</h4>
              <p className="text-sm text-blue-800">
                Los gráficos se actualizan automáticamente con los datos actuales del rodeo.
                Utiliza los filtros de la sección Lista para analizar segmentos específicos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
