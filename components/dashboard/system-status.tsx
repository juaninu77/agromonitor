"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wifi, Database, Shield, Server, Cpu } from "lucide-react"

const systemComponents = [
  {
    name: "Red de la Granja",
    status: "en línea",
    icon: Wifi,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    name: "Sensores IoT",
    status: "advertencia",
    icon: Cpu,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
  },
  {
    name: "Base de Datos",
    status: "en línea",
    icon: Database,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    name: "Sistema de Seguridad",
    status: "en línea",
    icon: Shield,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    name: "Servidor Principal",
    status: "en línea",
    icon: Server,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
]

export function SystemStatus() {
  const onlineCount = systemComponents.filter((c) => c.status === "en línea").length
  const warningCount = systemComponents.filter((c) => c.status === "advertencia").length
  const offlineCount = systemComponents.filter((c) => c.status === "desconectado").length

  const getStatusBadge = () => {
    if (offlineCount > 0) {
      return <Badge variant="destructive">Problemas Detectados</Badge>
    } else if (warningCount > 0) {
      return <Badge variant="secondary">Advertencias Menores</Badge>
    } else {
      return (
        <Badge variant="default" className="bg-green-600">
          Todos los Sistemas Operativos
        </Badge>
      )
    }
  }

  return (
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Estado del Sistema</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {systemComponents.map((component, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${component.bgColor}`}>
                  <component.icon className={`h-4 w-4 ${component.color}`} />
                </div>
                <span className="font-medium text-sm">{component.name}</span>
              </div>
              <Badge
                variant={
                  component.status === "en línea"
                    ? "default"
                    : component.status === "advertencia"
                      ? "secondary"
                      : "destructive"
                }
                className={component.status === "en línea" ? "bg-green-600" : ""}
              >
                {component.status}
              </Badge>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Tiempo Activo:</span>
            <span className="font-medium">99.8%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
