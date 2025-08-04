"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav"
import {
  Package,
  Search,
  Filter,
  Plus,
  Download,
  Settings,
  AlertTriangle,
  Clock,
  TrendingUp,
  BarChart3,
  Calendar,
  MapPin,
  DollarSign,
  Truck,
  Eye,
  Edit,
  RefreshCw,
} from "lucide-react"
import { inventoryItems } from "@/lib/mocks"

export default function InventoryPage() {
  const [selectedTab, setSelectedTab] = useState("resumen")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("todos")
  const [filterStatus, setFilterStatus] = useState("todos")

  const getStockStatus = (item: (typeof inventoryItems)[0]) => {
    if (item.quantity <= item.minStock) return "critico"
    if (item.quantity <= item.minStock * 1.5) return "bajo"
    if (item.quantity >= item.maxStock * 0.8) return "alto"
    return "normal"
  }

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case "critico":
        return "bg-red-100 text-red-800 border-red-200"
      case "bajo":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "normal":
        return "bg-green-100 text-green-800 border-green-200"
      case "alto":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStockStatusLabel = (status: string) => {
    switch (status) {
      case "critico":
        return "Crítico"
      case "bajo":
        return "Stock Bajo"
      case "normal":
        return "Normal"
      case "alto":
        return "Sobrestock"
      default:
        return "Desconocido"
    }
  }

  const categories = [...new Set(inventoryItems.map((item) => item.category))]
  const criticalItems = inventoryItems.filter((item) => getStockStatus(item) === "critico")
  const lowStockItems = inventoryItems.filter((item) => getStockStatus(item) === "bajo")
  const totalValue = inventoryItems.reduce((sum, item) => sum + item.quantity * item.cost, 0)

  const filteredItems = inventoryItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = filterCategory === "todos" || item.category === filterCategory
    const matchesStatus = filterStatus === "todos" || getStockStatus(item) === filterStatus
    return matchesSearch && matchesCategory && matchesStatus
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Navegación de Migas de Pan */}
      <BreadcrumbNav />

      {/* Sección de Encabezado */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            Gestión de Inventario
          </h1>
          <p className="text-muted-foreground mt-1">
            Controla suministros, monitorea niveles de stock y gestiona compras
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
            Configuración
          </Button>
          <Button size="sm" className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Artículo
          </Button>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-border hover:border-primary/30 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Artículos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground mb-2">{inventoryItems.length}</div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">{categories.length} Categorías</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border hover:border-red-300 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock Crítico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 mb-2">{criticalItems.length}</div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-600">Acción Inmediata Requerida</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border hover:border-yellow-300 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock Bajo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600 mb-2">{lowStockItems.length}</div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-yellow-600">Reordenar Pronto</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border hover:border-green-300 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 mb-2">${totalValue.toLocaleString()}</div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">+5.2% del mes pasado</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenido Principal */}
      <Card className="border-2 border-border">
        <CardContent className="p-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 border-2 border-border">
              <TabsTrigger value="resumen" className="border-r-2 border-border">
                Resumen
              </TabsTrigger>
              <TabsTrigger value="articulos" className="border-r-2 border-border">
                Todos los Artículos
              </TabsTrigger>
              <TabsTrigger value="alertas" className="border-r-2 border-border">
                Alertas de Stock
              </TabsTrigger>
              <TabsTrigger value="analiticas">Analíticas</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Resumen de Estado de Stock */}
                <Card className="border-2 border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      Resumen de Estado de Stock
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {categories.map((category) => {
                      const categoryItems = inventoryItems.filter((item) => item.category === category)
                      const criticalCount = categoryItems.filter((item) => getStockStatus(item) === "critico").length
                      const lowCount = categoryItems.filter((item) => getStockStatus(item) === "bajo").length
                      const normalCount = categoryItems.filter((item) => getStockStatus(item) === "normal").length

                      return (
                        <div key={category} className="p-4 border-2 border-border/50 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold">{category}</span>
                            <span className="text-sm text-muted-foreground">{categoryItems.length} artículos</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="text-center">
                              <div className="text-lg font-bold text-red-600">{criticalCount}</div>
                              <div className="text-xs text-muted-foreground">Crítico</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-yellow-600">{lowCount}</div>
                              <div className="text-xs text-muted-foreground">Bajo</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-600">{normalCount}</div>
                              <div className="text-xs text-muted-foreground">Normal</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                {/* Actividad Reciente */}
                <Card className="border-2 border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-green-600" />
                      Actividad Reciente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 border-2 border-border/50 rounded-lg">
                        <div className="p-2 rounded-full bg-green-100">
                          <Plus className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">Semilla de Maíz Híbrido reabastecida</p>
                          <p className="text-xs text-muted-foreground">150 kg agregados • hace 2 horas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 border-2 border-border/50 rounded-lg">
                        <div className="p-2 rounded-full bg-red-100">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">Fertilizante NPK stock crítico</p>
                          <p className="text-xs text-muted-foreground">Solo quedan 2 sacos • hace 4 horas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 border-2 border-border/50 rounded-lg">
                        <div className="p-2 rounded-full bg-blue-100">
                          <Truck className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">Suministros veterinarios entregados</p>
                          <p className="text-xs text-muted-foreground">12 viales antibióticos • ayer</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 border-2 border-border/50 rounded-lg">
                        <div className="p-2 rounded-full bg-yellow-100">
                          <Calendar className="h-4 w-4 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">Recordatorio vencimiento Glifosato</p>
                          <p className="text-xs text-muted-foreground">Vence en 6 meses • hace 2 días</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="articulos" className="mt-6">
              {/* Filtros */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Buscar artículos, proveedores o ubicaciones..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-2"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-48 border-2">
                      <SelectValue placeholder="Filtrar por categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas las Categorías</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-48 border-2">
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los Estados</SelectItem>
                      <SelectItem value="critico">Crítico</SelectItem>
                      <SelectItem value="bajo">Stock Bajo</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alto">Sobrestock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cuadrícula de Artículos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => {
                  const status = getStockStatus(item)
                  const stockPercentage = (item.quantity / item.maxStock) * 100

                  return (
                    <Card
                      key={item.id}
                      className="border-2 border-border hover:border-primary/30 hover:shadow-lg transition-all"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{item.name}</CardTitle>
                          <Badge className={getStockStatusColor(status)} variant="outline">
                            {getStockStatusLabel(status)}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          {item.category}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Stock Actual:</span>
                            <p className="font-semibold">
                              {item.quantity} {item.unit}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Costo Unitario:</span>
                            <p className="font-semibold">${item.cost}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Stock Mín:</span>
                            <p className="font-semibold">
                              {item.minStock} {item.unit}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valor Total:</span>
                            <p className="font-semibold">${(item.quantity * item.cost).toFixed(2)}</p>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span>Nivel de Stock</span>
                            <span>{Math.round(stockPercentage)}%</span>
                          </div>
                          <Progress
                            value={stockPercentage}
                            className={`h-2 ${
                              status === "critico" ? "bg-red-100" : status === "bajo" ? "bg-yellow-100" : "bg-green-100"
                            }`}
                          />
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Proveedor:</span>
                            <span className="font-medium">{item.supplier}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Ubicación:</span>
                            <span className="font-medium flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {item.location}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Último Reabastecimiento:</span>
                            <span className="font-medium">{new Date(item.lastRestocked).toLocaleDateString()}</span>
                          </div>
                          {item.expiryDate && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Vence:</span>
                              <span className="font-medium">{new Date(item.expiryDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="alertas" className="mt-6">
              <div className="space-y-6">
                {/* Alertas de Stock Crítico */}
                <Card className="border-2 border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      Alertas de Stock Crítico ({criticalItems.length})
                    </CardTitle>
                    <CardDescription className="text-red-700">
                      Artículos por debajo del nivel mínimo de stock - acción inmediata requerida
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {criticalItems.map((item) => (
                      <div key={item.id} className="p-4 bg-white border-2 border-red-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-red-800">{item.name}</h4>
                          <Badge className="bg-red-100 text-red-800 border-red-200">Crítico</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Actual:</span>
                            <p className="font-semibold text-red-600">
                              {item.quantity} {item.unit}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Mínimo:</span>
                            <p className="font-semibold">
                              {item.minStock} {item.unit}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Proveedor:</span>
                            <p className="font-semibold">{item.supplier}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Ubicación:</span>
                            <p className="font-semibold">{item.location}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" className="bg-red-600 hover:bg-red-700">
                            <Plus className="h-4 w-4 mr-1" />
                            Reordenar Ahora
                          </Button>
                          <Button size="sm" variant="outline">
                            Contactar Proveedor
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Advertencias de Stock Bajo */}
                <Card className="border-2 border-yellow-200 bg-yellow-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-yellow-800">
                      <Clock className="h-5 w-5" />
                      Advertencias de Stock Bajo ({lowStockItems.length})
                    </CardTitle>
                    <CardDescription className="text-yellow-700">
                      Artículos acercándose al nivel mínimo de stock - planificar reorden pronto
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {lowStockItems.map((item) => (
                      <div key={item.id} className="p-4 bg-white border-2 border-yellow-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-yellow-800">{item.name}</h4>
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Stock Bajo</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Actual:</span>
                            <p className="font-semibold text-yellow-600">
                              {item.quantity} {item.unit}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Mínimo:</span>
                            <p className="font-semibold">
                              {item.minStock} {item.unit}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Proveedor:</span>
                            <p className="font-semibold">{item.supplier}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Días Estimados:</span>
                            <p className="font-semibold">{Math.floor(Math.random() * 15) + 5} días</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" className="border-yellow-300 bg-transparent">
                            <Calendar className="h-4 w-4 mr-1" />
                            Programar Reorden
                          </Button>
                          <Button size="sm" variant="outline">
                            Ver Detalles
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="analiticas" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Valor de Inventario por Categoría */}
                <Card className="border-2 border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      Valor de Inventario por Categoría
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {categories.map((category) => {
                      const categoryItems = inventoryItems.filter((item) => item.category === category)
                      const categoryValue = categoryItems.reduce((sum, item) => sum + item.quantity * item.cost, 0)
                      const percentage = (categoryValue / totalValue) * 100

                      return (
                        <div key={category} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{category}</span>
                            <span className="font-semibold">${categoryValue.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={percentage} className="flex-1 h-2" />
                            <span className="text-sm text-muted-foreground w-12">{percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                {/* Tendencias de Movimiento de Stock */}
                <Card className="border-2 border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Tendencias de Movimiento de Stock
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-4 border-2 border-border/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">+15%</div>
                        <div className="text-sm text-muted-foreground">Aumento de Stock</div>
                        <div className="text-xs text-muted-foreground">Este Mes</div>
                      </div>
                      <div className="p-4 border-2 border-border/50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">$12.5k</div>
                        <div className="text-sm text-muted-foreground">Gasto Mensual Prom.</div>
                        <div className="text-xs text-muted-foreground">Últimos 6 Meses</div>
                      </div>
                      <div className="p-4 border-2 border-border/50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">8.5</div>
                        <div className="text-sm text-muted-foreground">Rotación Prom.</div>
                        <div className="text-xs text-muted-foreground">Veces por Año</div>
                      </div>
                      <div className="p-4 border-2 border-border/50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">92%</div>
                        <div className="text-sm text-muted-foreground">Precisión de Stock</div>
                        <div className="text-xs text-muted-foreground">Última Auditoría</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold">Principales Proveedores por Valor</h4>
                      {[...new Set(inventoryItems.map((item) => item.supplier))]
                        .map((supplier) => {
                          const supplierItems = inventoryItems.filter((item) => item.supplier === supplier)
                          const supplierValue = supplierItems.reduce((sum, item) => sum + item.quantity * item.cost, 0)
                          return { supplier, value: supplierValue, items: supplierItems.length }
                        })
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5)
                        .map((supplier) => (
                          <div key={supplier.supplier} className="flex justify-between items-center p-2 border rounded">
                            <div>
                              <div className="font-medium">{supplier.supplier}</div>
                              <div className="text-sm text-muted-foreground">{supplier.items} artículos</div>
                            </div>
                            <div className="font-semibold">${supplier.value.toLocaleString()}</div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
