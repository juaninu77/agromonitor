"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import {
  Activity,
  AlertTriangle,
  Battery,
  Droplets,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Thermometer,
  Wifi,
  WifiOff,
  Zap,
  Eye,
  Download,
  Bell,
  MapPin,
  Calendar,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav"

// Datos mock para dispositivos IoT
const iotDevices = [
  {
    id: "IOT-001",
    name: "Sensor Humedad Suelo - Potrero Norte",
    type: "Sensor de Humedad",
    category: "Agricultura",
    status: "active",
    battery: 85,
    signal: 92,
    location: "Potrero Norte - Sector A",
    coordinates: { lat: -34.6037, lng: -58.3816 },
    lastReading: "hace 2m",
    value: 68,
    unit: "%",
    threshold: { min: 40, max: 80 },
    alerts: 0,
    firmware: "v2.1.3",
  },
  {
    id: "IOT-002",
    name: "Collar Inteligente - Vaca #247",
    type: "Collar GPS",
    category: "Ganadería",
    status: "active",
    battery: 45,
    signal: 78,
    location: "Potrero Sur",
    coordinates: { lat: -34.6087, lng: -58.3856 },
    lastReading: "hace 5m",
    value: 24.5,
    unit: "°C",
    threshold: { min: 20, max: 30 },
    alerts: 1,
    firmware: "v1.8.2",
  },
  {
    id: "IOT-003",
    name: "Estación Meteorológica Central",
    type: "Estación Climática",
    category: "Clima",
    status: "active",
    battery: 95,
    signal: 88,
    location: "Centro de la Finca",
    coordinates: { lat: -34.6057, lng: -58.3836 },
    lastReading: "hace 1m",
    value: 26.2,
    unit: "°C",
    threshold: { min: 15, max: 35 },
    alerts: 0,
    firmware: "v3.0.1",
  },
  {
    id: "IOT-004",
    name: "Sensor pH Suelo - Cultivo Maíz",
    type: "Sensor pH",
    category: "Agricultura",
    status: "warning",
    battery: 25,
    signal: 65,
    location: "Lote Maíz A",
    coordinates: { lat: -34.6027, lng: -58.3876 },
    lastReading: "hace 15m",
    value: 6.8,
    unit: "pH",
    threshold: { min: 6.0, max: 7.5 },
    alerts: 2,
    firmware: "v2.0.8",
  },
  {
    id: "IOT-005",
    name: "Monitor Peso Automático",
    type: "Báscula IoT",
    category: "Ganadería",
    status: "offline",
    battery: 0,
    signal: 0,
    location: "Corral Principal",
    coordinates: { lat: -34.6047, lng: -58.3826 },
    lastReading: "hace 2h",
    value: 0,
    unit: "kg",
    threshold: { min: 200, max: 800 },
    alerts: 3,
    firmware: "v1.5.4",
  },
  {
    id: "IOT-006",
    name: "Sensor Flujo Agua - Bebedero Norte",
    type: "Sensor de Flujo",
    category: "Infraestructura",
    status: "active",
    battery: 72,
    signal: 85,
    location: "Bebedero Norte",
    coordinates: { lat: -34.6017, lng: -58.3796 },
    lastReading: "hace 3m",
    value: 12.5,
    unit: "L/min",
    threshold: { min: 5, max: 20 },
    alerts: 0,
    firmware: "v2.2.1",
  },
]

const deviceCategories = ["Todos", "Agricultura", "Ganadería", "Clima", "Infraestructura"]
const deviceStatuses = ["Todos", "active", "warning", "offline"]

const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800">Activo</Badge>
    case "warning":
      return <Badge className="bg-yellow-100 text-yellow-800">Advertencia</Badge>
    case "offline":
      return <Badge variant="destructive">Desconectado</Badge>
    default:
      return <Badge variant="outline">Desconocido</Badge>
  }
}

const getSignalIcon = (signal: number) => {
  if (signal > 70) return <Wifi className="h-4 w-4 text-green-500" />
  if (signal > 30) return <Wifi className="h-4 w-4 text-yellow-500" />
  return <WifiOff className="h-4 w-4 text-red-500" />
}

const getBatteryColor = (battery: number) => {
  if (battery > 50) return "bg-green-500"
  if (battery > 20) return "bg-yellow-500"
  return "bg-red-500"
}

export default function IoTPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("Todos")
  const [statusFilter, setStatusFilter] = useState("Todos")

  const filteredDevices = iotDevices.filter((device) => {
    const matchesSearch =
      device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.location.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "Todos" || device.category === categoryFilter
    const matchesStatus = statusFilter === "Todos" || device.status === statusFilter

    return matchesSearch && matchesCategory && matchesStatus
  })

  const activeDevices = iotDevices.filter((d) => d.status === "active").length
  const warningDevices = iotDevices.filter((d) => d.status === "warning").length
  const offlineDevices = iotDevices.filter((d) => d.status === "offline").length
  const totalAlerts = iotDevices.reduce((sum, d) => sum + d.alerts, 0)

  return (
    <div className="flex-1 space-y-6 p-6">
      <BreadcrumbNav
        items={[
          { label: "Panel Principal", href: "/" },
          { label: "IoT y Sensores", href: "/iot" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IoT y Sensores</h1>
          <p className="text-muted-foreground">Monitoreo y gestión de dispositivos inteligentes en la granja</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Dispositivo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispositivos Activos</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeDevices}</div>
            <p className="text-xs text-muted-foreground">de {iotDevices.length} dispositivos totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Advertencias</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{warningDevices}</div>
            <p className="text-xs text-muted-foreground">requieren atención</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desconectados</CardTitle>
            <WifiOff className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{offlineDevices}</div>
            <p className="text-xs text-muted-foreground">sin comunicación</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Activas</CardTitle>
            <Bell className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalAlerts}</div>
            <p className="text-xs text-muted-foreground">notificaciones pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices">Dispositivos</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoreo</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="analytics">Analíticas</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros y Búsqueda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar dispositivos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {deviceCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {deviceStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "Todos"
                          ? "Todos"
                          : status === "active"
                            ? "Activo"
                            : status === "warning"
                              ? "Advertencia"
                              : "Desconectado"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Dispositivos */}
          <Card>
            <CardHeader>
              <CardTitle>Dispositivos IoT ({filteredDevices.length})</CardTitle>
              <CardDescription>Gestión y monitoreo de sensores y dispositivos inteligentes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Batería</TableHead>
                    <TableHead>Señal</TableHead>
                    <TableHead>Última Lectura</TableHead>
                    <TableHead>Valor Actual</TableHead>
                    <TableHead>Alertas</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{device.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {device.type} • {device.id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(device.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{device.location}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Battery className={`h-4 w-4 ${device.battery > 20 ? "text-green-500" : "text-red-500"}`} />
                          <div className="w-16">
                            <Progress value={device.battery} className={`h-2 ${getBatteryColor(device.battery)}`} />
                          </div>
                          <span className="text-sm">{device.battery}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSignalIcon(device.signal)}
                          <span className="text-sm">{device.signal}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{device.lastReading}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {device.value} {device.unit}
                        </div>
                      </TableCell>
                      <TableCell>
                        {device.alerts > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            {device.alerts}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            0
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Métricas en Tiempo Real */}
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Monitoreo en Tiempo Real
                </CardTitle>
                <CardDescription>Lecturas actuales de sensores críticos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {iotDevices
                    .filter((d) => d.status === "active")
                    .slice(0, 6)
                    .map((device) => (
                      <div key={device.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {device.type.includes("Humedad") && <Droplets className="h-4 w-4 text-blue-500" />}
                            {device.type.includes("Temperatura") && <Thermometer className="h-4 w-4 text-red-500" />}
                            {device.type.includes("pH") && <Zap className="h-4 w-4 text-purple-500" />}
                            {device.type.includes("Flujo") && <Activity className="h-4 w-4 text-green-500" />}
                            <span className="text-sm font-medium">{device.type}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {device.lastReading}
                          </Badge>
                        </div>
                        <div className="text-2xl font-bold mb-1">
                          {device.value} {device.unit}
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">{device.location}</div>
                        <div className="flex items-center justify-between text-xs">
                          <span>
                            Rango: {device.threshold.min}-{device.threshold.max} {device.unit}
                          </span>
                          {device.value >= device.threshold.min && device.value <= device.threshold.max ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alertas y Notificaciones
              </CardTitle>
              <CardDescription>Gestión de alertas automáticas del sistema IoT</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {iotDevices
                  .filter((d) => d.alerts > 0)
                  .map((device) => (
                    <div key={device.id} className="p-4 border rounded-lg border-red-200 bg-red-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                          <div>
                            <div className="font-medium text-red-900">{device.name}</div>
                            <div className="text-sm text-red-700 mt-1">
                              {device.status === "warning" && "Batería baja detectada"}
                              {device.status === "offline" && "Dispositivo desconectado"}
                            </div>
                            <div className="text-xs text-red-600 mt-1">
                              {device.location} • {device.lastReading}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            Ver Detalles
                          </Button>
                          <Button variant="outline" size="sm">
                            Resolver
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Analíticas y Tendencias
              </CardTitle>
              <CardDescription>Análisis de datos históricos y patrones de comportamiento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Analíticas Avanzadas</h3>
                <p className="text-muted-foreground mb-4">
                  Próximamente: Gráficos de tendencias, análisis predictivo y reportes automatizados
                </p>
                <Button variant="outline">Configurar Analíticas</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuración del Sistema
              </CardTitle>
              <CardDescription>Ajustes generales y configuración de dispositivos IoT</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Actualizaciones Automáticas</div>
                    <div className="text-sm text-muted-foreground">
                      Actualizar firmware de dispositivos automáticamente
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Alertas por Email</div>
                    <div className="text-sm text-muted-foreground">
                      Recibir notificaciones de alertas críticas por correo
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Modo de Ahorro de Energía</div>
                    <div className="text-sm text-muted-foreground">
                      Reducir frecuencia de lecturas para ahorrar batería
                    </div>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Sincronización en la Nube</div>
                    <div className="text-sm text-muted-foreground">
                      Respaldar datos de sensores en la nube automáticamente
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex gap-2">
                  <Button>Guardar Configuración</Button>
                  <Button variant="outline">Restablecer Valores</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
