"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react"

const systemComponents = [
  {
    name: "Red de la Granja",
    status: "online",
    uptime: "99.9%",
    lastCheck: "hace 30s",
  },
  {
    name: "Sensores IoT",
    status: "warning",
    uptime: "98.5%",
    lastCheck: "hace 1m",
  },
  {
    name: "Base de Datos",
    status: "online",
    uptime: "100%",
    lastCheck: "hace 15s",
  },
  {
    name: "Sistema de Seguridad",
    status: "online",
    uptime: "99.8%",
    lastCheck: "hace 45s",
  },
  {
    name: "Servidor Principal",
    status: "offline",
    uptime: "95.2%",
    lastCheck: "hace 5m",
  },
]

const getStatusIcon = (status: string) => {
  switch (status) {
    case "online":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case "offline":
      return <XCircle className="h-4 w-4 text-red-500" />
    default:
      return <Clock className="h-4 w-4 text-gray-500" />
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case "online":
      return "en línea"
    case "warning":
      return "advertencia"
    case "offline":
      return "desconectado"
    default:
      return "desconocido"
  }
}

const getOverallStatus = () => {
  const onlineCount = systemComponents.filter((c) => c.status === "online").length
  const warningCount = systemComponents.filter((c) => c.status === "warning").length
  const offlineCount = systemComponents.filter((c) => c.status === "offline").length

  if (offlineCount > 0) {
    return { text: "Problemas Detectados", variant: "destructive" as const }
  } else if (warningCount > 0) {
    return { text: "Advertencias Menores", variant: "secondary" as const }
  } else {
    return { text: "Todos los Sistemas Operativos", variant: "default" as const }
  }
}

export function SystemStatus() {
  const overallStatus = getOverallStatus()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Estado del Sistema</span>
          <Badge variant={overallStatus.variant}>{overallStatus.text}</Badge>
        </CardTitle>
        <CardDescription>Monitoreo en tiempo real de componentes críticos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {systemComponents.map((component, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {getStatusIcon(component.status)}
                <div>
                  <div className="font-medium">{component.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {getStatusText(component.status)} • {component.lastCheck}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">Tiempo Activo:</div>
                <div className="text-sm text-muted-foreground">{component.uptime}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
