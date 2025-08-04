"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Activity, Zap, Droplets, Thermometer } from "lucide-react"

const metrics = [
  {
    name: "Sensores Activos",
    value: 24,
    total: 28,
    percentage: 86,
    status: "normal",
    icon: Activity,
    unit: "dispositivos",
  },
  {
    name: "Uso de Energía",
    value: 78,
    total: 100,
    percentage: 78,
    status: "alto",
    icon: Zap,
    unit: "kW",
  },
  {
    name: "Flujo de Agua",
    value: 1250,
    total: 2000,
    percentage: 63,
    status: "normal",
    icon: Droplets,
    unit: "L/min",
  },
  {
    name: "Temp. Promedio",
    value: 24,
    total: 35,
    percentage: 69,
    status: "crítico",
    icon: Thermometer,
    unit: "°C",
  },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "normal":
      return "text-green-600"
    case "alto":
      return "text-yellow-600"
    case "crítico":
      return "text-red-600"
    default:
      return "text-gray-600"
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "normal":
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          Normal
        </Badge>
      )
    case "alto":
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          Alto
        </Badge>
      )
    case "crítico":
      return <Badge variant="destructive">Crítico</Badge>
    default:
      return <Badge variant="outline">Desconocido</Badge>
  }
}

export function LiveMetrics() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Métricas en Vivo</span>
          <Badge variant="outline" className="animate-pulse">
            <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
            Tiempo real
          </Badge>
        </CardTitle>
        <CardDescription>Monitoreo continuo de parámetros operativos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {metrics.map((metric, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <metric.icon className={`h-4 w-4 ${getStatusColor(metric.status)}`} />
                  <span className="font-medium">{metric.name}</span>
                </div>
                {getStatusBadge(metric.status)}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    {metric.value} {metric.unit}
                  </span>
                  <span className="text-muted-foreground">{metric.percentage}%</span>
                </div>
                <Progress value={metric.percentage} className="h-2" />
              </div>

              <div className="text-xs text-muted-foreground">
                Máximo: {metric.total} {metric.unit}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
