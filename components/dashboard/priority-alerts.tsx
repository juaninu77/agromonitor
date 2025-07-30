"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { alerts } from "@/lib/mocks"
import { AlertTriangle, Clock, MapPin, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical":
      return "bg-red-500 text-white border-red-600"
    case "high":
      return "bg-orange-500 text-white border-orange-600"
    case "medium":
      return "bg-yellow-500 text-black border-yellow-600"
    case "low":
      return "bg-blue-500 text-white border-blue-600"
    default:
      return "bg-gray-500 text-white border-gray-600"
  }
}

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case "critical":
      return "CRÍTICO"
    case "high":
      return "ALTO"
    case "medium":
      return "MEDIO"
    case "low":
      return "BAJO"
    default:
      return priority.toUpperCase()
  }
}

export function PriorityAlerts() {
  const criticalAlerts = alerts
    .filter((alert) => alert.priority === "critical" || alert.priority === "high")
    .sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      return (
        priorityOrder[b.priority as keyof typeof priorityOrder] -
        priorityOrder[a.priority as keyof typeof priorityOrder]
      )
    })
    .slice(0, 3)

  return (
    <Card className="border-2 border-border hover:border-red-300 transition-colors">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Alertas Prioritarias
          <div className="ml-auto flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full pulse-dot border border-red-600"></div>
            <span className="text-xs text-muted-foreground">Requieren Acción</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {criticalAlerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              "p-4 rounded-lg border-2 transition-all hover:shadow-md",
              alert.priority === "critical" ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50",
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge className={cn("text-xs font-bold border-2", getPriorityColor(alert.priority))}>
                  {getPriorityLabel(alert.priority)}
                </Badge>
                <span className="text-xs text-muted-foreground">{alert.category}</span>
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {alert.timestamp}
              </span>
            </div>

            <h4 className="font-semibold text-foreground mb-1">{alert.title}</h4>
            <p className="text-sm text-muted-foreground mb-3">{alert.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>Sector Afectado</span>
                </div>
                {alert.actionRequired && (
                  <Badge variant="outline" className="text-xs border-2 border-red-300 text-red-700">
                    Acción Requerida
                  </Badge>
                )}
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs border-2 bg-transparent">
                Resolver
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}

        <div className="pt-2 border-t-2 border-border">
          <Button variant="ghost" className="w-full text-sm border-2 border-transparent hover:border-border">
            Ver Todas las Alertas ({alerts.length})
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
