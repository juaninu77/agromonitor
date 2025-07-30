"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Cloud, Droplets, Eye, Thermometer, Wind } from "lucide-react"

export function WeatherWidget() {
  return (
    <Card className="border-2 border-border hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          Condiciones Climáticas
          <div className="ml-auto flex items-center gap-1">
            <div className="w-2 h-2 bg-status-ok rounded-full pulse-dot border border-status-ok/30"></div>
            <span className="text-xs text-muted-foreground">En Vivo</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Thermometer className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">24°C</p>
              <p className="text-xs text-muted-foreground">Temperatura</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">Parcialmente Nublado</p>
            <p className="text-xs text-muted-foreground">Sensación térmica 26°C</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2 border-t-2 border-border/50">
          <div className="text-center p-2 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-center mb-1">
              <Droplets className="h-4 w-4 text-status-water" />
            </div>
            <p className="text-sm font-medium">68%</p>
            <p className="text-xs text-muted-foreground">Humedad</p>
          </div>
          <div className="text-center p-2 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-center mb-1">
              <Wind className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">12 km/h</p>
            <p className="text-xs text-muted-foreground">Viento</p>
          </div>
          <div className="text-center p-2 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-center mb-1">
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">8 km</p>
            <p className="text-xs text-muted-foreground">Visibilidad</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
