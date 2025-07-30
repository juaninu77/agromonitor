"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Zap, Droplets, Thermometer } from "lucide-react"

const liveMetrics = [
  {
    label: "Active Sensors",
    value: "247",
    change: "+3",
    icon: Activity,
    color: "text-status-ok",
    bg: "bg-status-ok/10",
  },
  {
    label: "Power Usage",
    value: "1.2kW",
    change: "-0.3kW",
    icon: Zap,
    color: "text-status-warn",
    bg: "bg-status-warn/10",
  },
  {
    label: "Water Flow",
    value: "450L/min",
    change: "+12L/min",
    icon: Droplets,
    color: "text-status-water",
    bg: "bg-status-water/10",
  },
  {
    label: "Avg Temp",
    value: "22.5°C",
    change: "+1.2°C",
    icon: Thermometer,
    color: "text-primary",
    bg: "bg-primary/10",
  },
]

export function LiveMetrics() {
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Live Metrics
          <div className="ml-auto flex items-center gap-1">
            <div className="w-2 h-2 bg-status-ok rounded-full pulse-dot"></div>
            <span className="text-xs text-muted-foreground">Real-time</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {liveMetrics.map((metric, index) => (
            <div key={index} className="p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-md ${metric.bg}`}>
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                </div>
                <span className="text-xs text-muted-foreground">{metric.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{metric.value}</span>
                <Badge variant="outline" className={metric.change.startsWith("+") ? "status-online" : "status-warning"}>
                  {metric.change}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
