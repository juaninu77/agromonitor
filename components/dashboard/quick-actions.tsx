"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, AlertTriangle, Camera, FileText, Settings, Zap, Calendar, MapPin } from "lucide-react"

const quickActions = [
  { icon: Plus, label: "Add Animal", color: "text-status-ok", bg: "bg-status-ok/10" },
  { icon: AlertTriangle, label: "Report Issue", color: "text-status-alert", bg: "bg-status-alert/10" },
  { icon: Camera, label: "Take Photo", color: "text-primary", bg: "bg-primary/10" },
  { icon: FileText, label: "New Report", color: "text-muted-foreground", bg: "bg-muted" },
  { icon: Calendar, label: "Schedule Task", color: "text-status-warn", bg: "bg-status-warn/10" },
  { icon: MapPin, label: "Check Location", color: "text-status-water", bg: "bg-status-water/10" },
  { icon: Zap, label: "IoT Control", color: "text-chart-4", bg: "bg-chart-4/10" },
  { icon: Settings, label: "Settings", color: "text-muted-foreground", bg: "bg-muted" },
]

export function QuickActions() {
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              className="h-auto p-3 flex flex-col items-center gap-2 hover:scale-105 transition-transform border border-transparent hover:border-border/50"
            >
              <div className={`p-2 rounded-lg ${action.bg}`}>
                <action.icon className={`h-4 w-4 ${action.color}`} />
              </div>
              <span className="text-xs font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
