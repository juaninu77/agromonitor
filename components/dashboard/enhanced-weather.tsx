"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { weatherData } from "@/lib/mocks"
import { Cloud, Droplets, Thermometer, Wind, Sun, Gauge, Umbrella, TrendingUp, TrendingDown } from "lucide-react"

export function EnhancedWeather() {
  return (
    <Card className="border-2 border-border hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          Centro Meteorológico
          <div className="ml-auto flex items-center gap-1">
            <div className="w-2 h-2 bg-status-ok rounded-full pulse-dot border border-status-ok/30"></div>
            <span className="text-xs text-muted-foreground">Actualizado</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Weather */}
        <div className="flex items-center justify-between p-3 rounded-lg border-2 border-border/50 bg-gradient-to-r from-blue-50 to-sky-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Thermometer className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{weatherData.temperature}°C</p>
              <p className="text-sm text-muted-foreground">{weatherData.condition}</p>
            </div>
          </div>
          <div className="text-right">
            <Badge className="status-online mb-1">Condiciones Óptimas</Badge>
            <p className="text-xs text-muted-foreground">Para actividades agrícolas</p>
          </div>
        </div>

        {/* Weather Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border-2 border-border/50 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="h-4 w-4 text-status-water" />
              <span className="text-xs text-muted-foreground">Humedad</span>
            </div>
            <p className="text-lg font-bold">{weatherData.humidity}%</p>
          </div>

          <div className="p-3 rounded-lg border-2 border-border/50 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Wind className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Viento</span>
            </div>
            <p className="text-lg font-bold">{weatherData.windSpeed} km/h</p>
            <p className="text-xs text-muted-foreground">{weatherData.windDirection}</p>
          </div>

          <div className="p-3 rounded-lg border-2 border-border/50 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Sun className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Índice UV</span>
            </div>
            <p className="text-lg font-bold">{weatherData.uvIndex}</p>
            <Badge className="status-warning text-xs">Moderado</Badge>
          </div>

          <div className="p-3 rounded-lg border-2 border-border/50 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Presión</span>
            </div>
            <p className="text-lg font-bold">{weatherData.pressure}</p>
            <p className="text-xs text-muted-foreground">hPa</p>
          </div>
        </div>

        {/* 5-Day Forecast */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Pronóstico 5 Días</h4>
          <div className="space-y-2">
            {weatherData.forecast.map((day, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium w-16">{day.day}</span>
                  <span className="text-xs text-muted-foreground">{day.condition}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Umbrella className="h-3 w-3 text-blue-500" />
                    <span className="text-xs">{day.precipitation}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-red-500" />
                    <span className="text-sm font-medium">{day.high}°</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-blue-500" />
                    <span className="text-sm text-muted-foreground">{day.low}°</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
