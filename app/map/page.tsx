"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav"
import {
  Map,
  Search,
  Filter,
  Download,
  Settings,
  Maximize2,
  MapPin,
  Layers,
  Info,
  Thermometer,
  Droplets,
  Wind,
  RefreshCw,
  Navigation,
  Zap,
} from "lucide-react"
import { mapLayers, mapZones, mapMarkers, weatherStations } from "@/lib/mocks"
import type { MapZone, MapMarker } from "@/lib/types"

export default function MapPage() {
  const [activeLayers, setActiveLayers] = useState<string[]>(
    mapLayers.filter((layer) => layer.visible).map((layer) => layer.id),
  )
  const [selectedZone, setSelectedZone] = useState<MapZone | null>(null)
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [mapView, setMapView] = useState<"satellite" | "terrain" | "hybrid">("satellite")

  const toggleLayer = (layerId: string) => {
    setActiveLayers((prev) => (prev.includes(layerId) ? prev.filter((id) => id !== layerId) : [...prev, layerId]))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "bueno":
      case "activo":
        return "bg-green-500"
      case "regular":
        return "bg-yellow-500"
      case "malo":
      case "inactivo":
        return "bg-red-500"
      case "critico":
      case "alerta":
        return "bg-red-600"
      case "mantenimiento":
        return "bg-orange-500"
      default:
        return "bg-gray-500"
    }
  }

  const filteredZones = mapZones.filter(
    (zone) =>
      zone.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      zone.details.cultivo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      zone.details.responsable?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredMarkers = mapMarkers.filter((marker) => marker.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb Navigation */}
      <BreadcrumbNav />

      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Map className="h-8 w-8 text-primary" />
            Mapa de la Propiedad
          </h1>
          <p className="text-muted-foreground mt-1">
            Vista georreferenciada de potreros, cultivos, vehículos y sensores IoT
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl bg-transparent">
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl bg-transparent">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl bg-transparent">
            <Settings className="mr-2 h-4 w-4" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Main Map Interface */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Map Area */}
        <div className="lg:col-span-8">
          <Card className="border-2 border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Hacienda San José - Vista General
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Navigation className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Vista:</span>
                  <div className="flex rounded-lg border">
                    {["satellite", "terrain", "hybrid"].map((view) => (
                      <Button
                        key={view}
                        variant={mapView === view ? "default" : "ghost"}
                        size="sm"
                        className="rounded-none first:rounded-l-lg last:rounded-r-lg"
                        onClick={() => setMapView(view as any)}
                      >
                        {view === "satellite" ? "Satélite" : view === "terrain" ? "Terreno" : "Híbrido"}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar en el mapa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Simulated Map Area */}
              <div className="relative h-[600px] bg-gradient-to-br from-green-100 to-green-200 overflow-hidden">
                {/* Map Background Pattern */}
                <div className="absolute inset-0 opacity-20">
                  <div className="grid grid-cols-20 grid-rows-20 h-full w-full">
                    {Array.from({ length: 400 }).map((_, i) => (
                      <div key={i} className="border border-green-300/30"></div>
                    ))}
                  </div>
                </div>

                {/* Zones (Potreros y Cultivos) */}
                {filteredZones.map((zone) => {
                  if (!activeLayers.includes(zone.type === "potrero" ? "potreros" : "cultivos")) return null

                  const isSelected = selectedZone?.id === zone.id
                  const baseStyle =
                    zone.type === "potrero" ? "bg-green-400/30 border-green-600" : "bg-yellow-400/30 border-yellow-600"

                  return (
                    <div
                      key={zone.id}
                      className={`absolute rounded-lg border-2 cursor-pointer transition-all hover:scale-105 ${baseStyle} ${
                        isSelected ? "ring-4 ring-primary/50 scale-105" : ""
                      }`}
                      style={{
                        left: `${((zone.center.lng + 58.39) / 0.015) * 100}%`,
                        top: `${((zone.center.lat + 34.61) / 0.012) * 100}%`,
                        width: `${Math.sqrt(zone.area) * 8}px`,
                        height: `${Math.sqrt(zone.area) * 6}px`,
                        transform: `translate(-50%, -50%) ${isSelected ? "scale(1.05)" : ""}`,
                      }}
                      onClick={() => setSelectedZone(zone)}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-xs font-semibold text-gray-800">{zone.name}</div>
                          <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${getStatusColor(zone.status)}`}></div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Markers (Vehículos, Sensores, etc.) */}
                {filteredMarkers.map((marker) => {
                  if (
                    !activeLayers.includes(
                      marker.type === "vehiculo"
                        ? "vehiculos"
                        : marker.type === "sensor"
                          ? "sensores"
                          : marker.type === "alerta"
                            ? "alertas"
                            : marker.type === "agua"
                              ? "agua"
                              : "infraestructura",
                    )
                  )
                    return null

                  const isSelected = selectedMarker?.id === marker.id
                  const Icon = marker.icon

                  return (
                    <div
                      key={marker.id}
                      className={`absolute cursor-pointer transition-all hover:scale-110 ${
                        isSelected ? "scale-125 z-20" : "z-10"
                      }`}
                      style={{
                        left: `${((marker.coordinates.lng + 58.39) / 0.015) * 100}%`,
                        top: `${((marker.coordinates.lat + 34.61) / 0.012) * 100}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      onClick={() => setSelectedMarker(marker)}
                    >
                      <div
                        className={`p-2 rounded-full shadow-lg border-2 ${
                          marker.status === "activo"
                            ? "bg-green-500 border-green-600"
                            : marker.status === "alerta"
                              ? "bg-red-500 border-red-600"
                              : marker.status === "mantenimiento"
                                ? "bg-orange-500 border-orange-600"
                                : "bg-gray-500 border-gray-600"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      {isSelected && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white rounded-lg shadow-lg border p-2 min-w-48 z-30">
                          <div className="text-sm font-semibold">{marker.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">{marker.type}</div>
                          <Badge variant={marker.status === "activo" ? "default" : "destructive"} className="mt-1">
                            {marker.status}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Weather Stations */}
                {activeLayers.includes("sensores") &&
                  weatherStations.map((station) => (
                    <div
                      key={station.id}
                      className="absolute z-10"
                      style={{
                        left: `${((station.coordinates.lng + 58.39) / 0.015) * 100}%`,
                        top: `${((station.coordinates.lat + 34.61) / 0.012) * 100}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <div className="bg-blue-500 p-2 rounded-full shadow-lg border-2 border-blue-600">
                        <Thermometer className="h-4 w-4 text-white" />
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-white rounded px-2 py-1 shadow text-xs">
                        {station.temperature}°C
                      </div>
                    </div>
                  ))}

                {/* Map Scale */}
                <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-2">
                  <div className="text-xs text-muted-foreground mb-1">Escala</div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-black"></div>
                    <span className="text-xs">500m</span>
                  </div>
                </div>

                {/* Coordinates Display */}
                <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-2">
                  <div className="text-xs text-muted-foreground">34°36'S, 58°23'W</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Control Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* Layer Controls */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Capas del Mapa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mapLayers.map((layer) => {
                const Icon = layer.icon
                const isActive = activeLayers.includes(layer.id)
                return (
                  <div key={layer.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" style={{ color: layer.color }} />
                      <span className="text-sm">{layer.name}</span>
                    </div>
                    <Switch checked={isActive} onCheckedChange={() => toggleLayer(layer.id)} />
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Weather Conditions */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Thermometer className="h-5 w-5" />
                Condiciones Climáticas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="current" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="current">Actual</TabsTrigger>
                  <TabsTrigger value="stations">Estaciones</TabsTrigger>
                </TabsList>
                <TabsContent value="current" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <Thermometer className="h-6 w-6 mx-auto mb-1 text-red-500" />
                      <div className="text-2xl font-bold">24°C</div>
                      <div className="text-xs text-muted-foreground">Temperatura</div>
                    </div>
                    <div className="text-center">
                      <Droplets className="h-6 w-6 mx-auto mb-1 text-blue-500" />
                      <div className="text-2xl font-bold">68%</div>
                      <div className="text-xs text-muted-foreground">Humedad</div>
                    </div>
                    <div className="text-center">
                      <Wind className="h-6 w-6 mx-auto mb-1 text-gray-500" />
                      <div className="text-2xl font-bold">12km/h</div>
                      <div className="text-xs text-muted-foreground">Viento</div>
                    </div>
                    <div className="text-center">
                      <Zap className="h-6 w-6 mx-auto mb-1 text-yellow-500" />
                      <div className="text-2xl font-bold">45%</div>
                      <div className="text-xs text-muted-foreground">Hum. Suelo</div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="stations" className="space-y-3">
                  {weatherStations.map((station) => (
                    <div key={station.id} className="p-3 border rounded-lg">
                      <div className="font-semibold text-sm">{station.name}</div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                        <div>{station.temperature}°C</div>
                        <div>{station.humidity}%</div>
                        <div>{station.windSpeed}km/h</div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Actualizado {station.lastUpdate}</div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Zone/Marker Details */}
          {(selectedZone || selectedMarker) && (
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Detalles
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedZone && (
                  <div className="space-y-3">
                    <div>
                      <div className="font-semibold">{selectedZone.name}</div>
                      <div className="text-sm text-muted-foreground capitalize">{selectedZone.type}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Área</div>
                        <div className="font-semibold">{selectedZone.area} ha</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Estado</div>
                        <Badge variant={selectedZone.status === "bueno" ? "default" : "destructive"}>
                          {selectedZone.status}
                        </Badge>
                      </div>
                    </div>
                    {selectedZone.details.ganado && (
                      <div>
                        <div className="text-muted-foreground text-sm">Ganado</div>
                        <div className="font-semibold">{selectedZone.details.ganado} cabezas</div>
                      </div>
                    )}
                    {selectedZone.details.cultivo && (
                      <div>
                        <div className="text-muted-foreground text-sm">Cultivo</div>
                        <div className="font-semibold">{selectedZone.details.cultivo}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-muted-foreground text-sm">Estado</div>
                      <div className="font-semibold">{selectedZone.details.estado}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-sm">Responsable</div>
                      <div className="font-semibold">{selectedZone.details.responsable}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-sm">Última Inspección</div>
                      <div className="font-semibold">{selectedZone.details.ultimaInspeccion}</div>
                    </div>
                    <Button size="sm" className="w-full" onClick={() => setSelectedZone(null)}>
                      Cerrar Detalles
                    </Button>
                  </div>
                )}
                {selectedMarker && (
                  <div className="space-y-3">
                    <div>
                      <div className="font-semibold">{selectedMarker.name}</div>
                      <div className="text-sm text-muted-foreground capitalize">{selectedMarker.type}</div>
                    </div>
                    <Badge variant={selectedMarker.status === "activo" ? "default" : "destructive"}>
                      {selectedMarker.status}
                    </Badge>
                    {selectedMarker.type === "sensor" && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">Temperatura</div>
                          <div className="font-semibold">{selectedMarker.details.temperature}°C</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Humedad</div>
                          <div className="font-semibold">{selectedMarker.details.humidity}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Batería</div>
                          <div className="font-semibold">{selectedMarker.details.battery}%</div>
                        </div>
                      </div>
                    )}
                    <Button size="sm" className="w-full" onClick={() => setSelectedMarker(null)}>
                      Cerrar Detalles
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Resumen Rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Hectáreas</span>
                <span className="font-semibold">177.7 ha</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Potreros Activos</span>
                <span className="font-semibold">2 de 2</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Cultivos</span>
                <span className="font-semibold">2 lotes</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Vehículos Activos</span>
                <span className="font-semibold">1 de 4</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Sensores Online</span>
                <span className="font-semibold">8 de 10</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Alertas Activas</span>
                <span className="font-semibold text-red-600">3</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
