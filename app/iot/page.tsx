"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav"
import {
  Cpu,
  Battery,
  MapPin,
  Search,
  Download,
  Settings,
  Plus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Thermometer,
  Droplets,
  Wind,
  Eye,
  MoreHorizontal,
} from "lucide-react"

// Mock data para dispositivos IoT
const iotDevices = [
  {
    id: "IOT-001",
    name: "Sensor Humedad Sector A",
    type: "Sensor de Humedad",
    category: "Agricultura",
    status: "online",
    battery: 85,
    signal: 92,
    location: "Sector A - Cultivo Maíz",
    lastReading: "2024-01-15 14:30",
    value: "65%",
    firmware: "v2.1.3",
  },
  {
    id: "IOT-002",
    name: "Collar GPS Vaca #247",
    type: "Collar Inteligente",
    category: "Ganadería",
    status: "online",
    battery: 72,
    signal: 88,
    location: "Potrero Norte",
    lastReading: "2024-01-15 14:28",
    value: "36.8°C",
    firmware: "v1.8.2",
  },
  {
    id: "IOT-003",
    name: "Estación Meteorológica",
    type: "Sensor Climático",
    category: "Ambiente",
    status: "warning",
    battery: 45,
    signal: 76,
    location: "Centro de la Finca",
    lastReading: "2024-01-15 14:25",
    value: "24.5°C",
    firmware: "v3.0.1",
  },
  {
    id: "IOT-004",
    name: "Sensor pH Suelo B",
    type: "Sensor de pH",
    category: "Agricultura",
    status: "offline",
    battery: 12,
    signal: 0,
    location: "Sector B - Cultivo Soja",
    lastReading: "2024-01-15 12:15",
    value: "6.8 pH",
    firmware: "v2.0.5",
  },
  {
    id: "IOT-005",
    name: "Báscula Automática #1",
    type: "Báscula IoT",
    category: "Ganadería",
    status: "online",
    battery: 91,
    signal: 95,
    location: "Corral Principal",
    lastReading: "2024-01-15 14:32",
    value: "485 kg",
    firmware: "v1.5.7",
  },
  {
    id: "IOT-006",
    name: "Sensor Flujo Agua",
    type: "Medidor de Flujo",
    category: "Riego",
    status: "online",
    battery: 78,
    signal: 84,
    location: "Sistema Riego Principal",
    lastReading: "2024-01-15 14:31",
    value: "156 L/min",
    firmware: "v2.2.1",
  },
]

const alerts = [
  {
    id: "ALERT-001",
    device: "Sensor pH Suelo B",
    type: "Crítica",
    message: "Dispositivo desconectado hace 2 horas",
    timestamp: "2024-01-15 12:15",
    severity: "critical",
  },
  {
    id: "ALERT-002",
    device: "Estación Meteorológica",
    type: "Advertencia",
    message: "Batería baja (45%)",
    timestamp: "2024-01-15 13:45",
    severity: "warning",
  },
  {
    id: "ALERT-003",
    device: "Collar GPS Vaca #247",
    type: "Información",
    message: "Animal fuera del área designada",
    timestamp: "2024-01-15 14:10",
    severity: "info",
  },
]

const monitoringData = [
  {
    sensor: "Sensor Humedad Sector A",
    reading: "65%",
    status: "Normal",
    trend: "stable",
    icon: Droplets,
    color: "text-blue-600",
  },
  {
    sensor: "Collar GPS Vaca #247",
    reading: "36.8°C",
    status: "Normal",
    trend: "up",
    icon: Thermometer,
    color: "text-green-600",
  },
  {
    sensor: "Estación Meteorológica",
    reading: "24.5°C",
    status: "Alto",
    trend: "up",
    icon: Wind,
    color: "text-yellow-600",
  },
  {
    sensor: "Sensor Flujo Agua",
    reading: "156 L/min",
    status: "Normal",
    trend: "stable",
    icon: Droplets,
    color: "text-blue-600",
  },
]

export default function IoTPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  const breadcrumbItems = [
    { label: "Dashboard", href: "/" },
    { label: "IoT", href: "/iot" },
  ]

  // Filtrar dispositivos
  const filteredDevices = iotDevices.filter((device) => {
    const matchesSearch =
      device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.type.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || device.status === statusFilter
    const matchesCategory = categoryFilter === "all" || device.category === categoryFilter

    return matchesSearch && matchesStatus && matchesCategory
  })

  // Calcular estadísticas
  const totalDevices = iotDevices.length
  const onlineDevices = iotDevices.filter((d) => d.status === "online").length
  const warningDevices = iotDevices.filter((d) => d.status === "warning").length
  const offlineDevices = iotDevices.filter((d) => d.status === "offline").length
  const activeAlerts = alerts.length

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case "offline":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Cpu className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge className="bg-green-600">En Línea</Badge>
      case "warning":
        return <Badge variant="secondary">Advertencia</Badge>
      case "offline":
        return <Badge variant="destructive">Desconectado</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const getBatteryColor = (battery: number) => {
    if (battery > 60) return "text-green-600"
    if (battery > 30) return "text-yellow-600"
    return "text-red-600"
  }

  const getSignalBars = (signal: number) => {
    const bars = Math.ceil(signal / 25)
    return Array.from({ length: 4 }, (_, i) => (
      <div
        key={i}
        className={`w-1 ${i < bars ? "bg-green-600" : "bg-gray-300"} ${
          i === 0 ? "h-2" : i === 1 ? "h-3" : i === 2 ? "h-4" : "h-5"
        }`}
      />
    ))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-6">
        <BreadcrumbNav items={breadcrumbItems} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Internet de las Cosas (IoT)</h1>
            <p className="text-gray-600 mt-1">Gestión y monitoreo de dispositivos inteligentes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Dispositivo
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Dispositivos</p>
                  <p className="text-2xl font-bold text-gray-900">{totalDevices}</p>
                </div>
                <Cpu className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">En Línea</p>
                  <p className="text-2xl font-bold text-green-600">{onlineDevices}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Advertencias</p>
                  <p className="text-2xl font-bold text-yellow-600">{warningDevices}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Desconectados</p>
                  <p className="text-2xl font-bold text-red-600">{offlineDevices}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Alertas Activas</p>
                  <p className="text-2xl font-bold text-orange-600">{activeAlerts}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="devices" className="space-y-4">
          <TabsList className="bg-white">
            <TabsTrigger value="devices">Dispositivos</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoreo</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
            <TabsTrigger value="analytics">Analíticas</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="devices" className="space-y-4">
            {/* Filtros */}
            <Card className="bg-white">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar dispositivos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Estados</SelectItem>
                      <SelectItem value="online">En Línea</SelectItem>
                      <SelectItem value="warning">Advertencia</SelectItem>
                      <SelectItem value="offline">Desconectado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las Categorías</SelectItem>
                      <SelectItem value="Agricultura">Agricultura</SelectItem>
                      <SelectItem value="Ganadería">Ganadería</SelectItem>
                      <SelectItem value="Ambiente">Ambiente</SelectItem>
                      <SelectItem value="Riego">Riego</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Dispositivos */}
            <div className="grid gap-4">
              {filteredDevices.map((device) => (
                <Card key={device.id} className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(device.status)}
                          <div>
                            <h3 className="font-semibold text-gray-900">{device.name}</h3>
                            <p className="text-sm text-gray-600">{device.type}</p>
                          </div>
                        </div>
                        <Badge variant="outline">{device.category}</Badge>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">Batería</p>
                          <div className="flex items-center gap-1">
                            <Battery className={`h-4 w-4 ${getBatteryColor(device.battery)}`} />
                            <span className={`text-sm font-medium ${getBatteryColor(device.battery)}`}>
                              {device.battery}%
                            </span>
                          </div>
                        </div>

                        <div className="text-center">
                          <p className="text-sm text-gray-600">Señal</p>
                          <div className="flex items-center gap-1">
                            <div className="flex items-end gap-0.5">{getSignalBars(device.signal)}</div>
                            <span className="text-sm font-medium text-gray-900 ml-1">{device.signal}%</span>
                          </div>
                        </div>

                        <div className="text-center">
                          <p className="text-sm text-gray-600">Ubicación</p>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-gray-600" />
                            <span className="text-sm text-gray-900">{device.location}</span>
                          </div>
                        </div>

                        <div className="text-center">
                          <p className="text-sm text-gray-600">Última Lectura</p>
                          <p className="text-sm font-medium text-gray-900">{device.value}</p>
                          <p className="text-xs text-gray-500">{device.lastReading}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusBadge(device.status)}
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {monitoringData.map((item, index) => (
                <Card key={index} className="bg-white">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{item.sensor}</CardTitle>
                      <item.icon className={`h-6 w-6 ${item.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{item.reading}</span>
                        <Badge variant={item.status === "Normal" ? "default" : "secondary"}>{item.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Activity className="h-4 w-4" />
                        <span>
                          Tendencia:{" "}
                          {item.trend === "up" ? "↗️ Subiendo" : item.trend === "down" ? "↘️ Bajando" : "➡️ Estable"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Card key={alert.id} className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-2 rounded-full ${
                            alert.severity === "critical"
                              ? "bg-red-100"
                              : alert.severity === "warning"
                                ? "bg-yellow-100"
                                : "bg-blue-100"
                          }`}
                        >
                          <AlertTriangle
                            className={`h-4 w-4 ${
                              alert.severity === "critical"
                                ? "text-red-600"
                                : alert.severity === "warning"
                                  ? "text-yellow-600"
                                  : "text-blue-600"
                            }`}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{alert.device}</h3>
                          <p className="text-sm text-gray-600">{alert.message}</p>
                          <p className="text-xs text-gray-500">{alert.timestamp}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            alert.severity === "critical"
                              ? "destructive"
                              : alert.severity === "warning"
                                ? "secondary"
                                : "default"
                          }
                        >
                          {alert.type}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalles
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Análisis de Dispositivos IoT</CardTitle>
                <CardDescription>Métricas y tendencias de rendimiento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Dispositivos En Línea</span>
                      <span className="text-sm text-gray-600">
                        {onlineDevices}/{totalDevices}
                      </span>
                    </div>
                    <Progress value={(onlineDevices / totalDevices) * 100} className="h-2" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Promedio de Batería</span>
                      <span className="text-sm text-gray-600">72%</span>
                    </div>
                    <Progress value={72} className="h-2" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Calidad de Señal</span>
                      <span className="text-sm text-gray-600">87%</span>
                    </div>
                    <Progress value={87} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Configuración del Sistema IoT</CardTitle>
                <CardDescription>Ajustes generales y umbrales de alertas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Umbrales de Alertas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Batería Baja (%)</label>
                      <Input type="number" defaultValue="30" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Señal Débil (%)</label>
                      <Input type="number" defaultValue="40" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Temperatura Crítica (°C)</label>
                      <Input type="number" defaultValue="35" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Humedad Mínima (%)</label>
                      <Input type="number" defaultValue="20" className="mt-1" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Frecuencia de Lecturas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Sensores Ambientales (minutos)</label>
                      <Input type="number" defaultValue="5" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Sensores de Ganado (minutos)</label>
                      <Input type="number" defaultValue="10" className="mt-1" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button>Guardar Configuración</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
