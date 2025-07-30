"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Server, Wifi, Database, Shield, Activity, CheckCircle, AlertCircle, XCircle } from "lucide-react"

const systemComponents = [
  { name: "Farm Network", status: "online", icon: Wifi, uptime: "99.9%" },
  { name: "IoT Sensors", status: "online", icon: Activity, uptime: "98.7%" },
  { name: "Database", status: "online", icon: Database, uptime: "100%" },
  { name: "Security System", status: "warning", icon: Shield, uptime: "95.2%" },
  { name: "Main Server", status: "online", icon: Server, uptime: "99.8%" },
]

const getStatusIcon = (status: string) => {
  switch (status) {
    case "online":
      return <CheckCircle className="h-4 w-4 text-status-ok" />
    case "warning":
      return <AlertCircle className="h-4 w-4 text-status-warn" />
    case "offline":
      return <XCircle className="h-4 w-4 text-status-alert" />
    default:
      return <CheckCircle className="h-4 w-4 text-status-ok" />
  }
}

const getStatusClass = (status: string) => {
  switch (status) {
    case "online":
      return "status-online"
    case "warning":
      return "status-warning"
    case "offline":
      return "status-critical"
    default:
      return "status-online"
  }
}

export function SystemStatus() {
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          System Status
          <div className="ml-auto">
            <Badge variant="outline" className="status-online">
              All Systems Operational
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {systemComponents.map((component, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-muted">
                  <component.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{component.name}</p>
                  <p className="text-xs text-muted-foreground">Uptime: {component.uptime}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(component.status)}
                <span className={`status-indicator ${getStatusClass(component.status)}`}>{component.status}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
