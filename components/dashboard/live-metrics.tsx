"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Zap, Droplets, Thermometer } from "lucide-react"

const metrics = [
  {
    title: "Sensores Activos",
    value: "47/52",
    icon: Activity,
    status: "Normal",
    color: "text-green-600",
    bgColor: "bg-green-50",
    statusColor: "bg-green-600",
  },
  {
    title: "Uso de Energía",
    value: "2.4 kW",
    icon: Zap,
    status: "Alto",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    statusColor: "bg-yellow-600",
  },
  {
    title: "Flujo de Agua",
    value: "156 L/min",
    icon: Droplets,
    status: "Normal",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    statusColor: "bg-green-600",
  },
  {
    title: "Temp. Promedio",
    value: "24.5°C",
    icon: Thermometer,
    status: "Crítico",
    color: "text-red-600",
    bgColor: "bg-red-50",
    statusColor: "bg-red-600",
  },
]

export function LiveMetrics() {
  return (
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Métricas en Vivo</CardTitle>
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            Tiempo real
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric, index) => (
            <div key={index} className="p-3 rounded-lg border bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                </div>
                <Badge variant="outline" className={`text-xs ${metric.statusColor} text-white border-0`}>
                  {metric.status}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{metric.title}</p>
                <p className="text-lg font-semibold">{metric.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
