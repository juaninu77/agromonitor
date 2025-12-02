"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Calendar,
  Download,
  Filter,
  Plus,
  Search,
  CreditCard,
  Wallet,
  Target,
  AlertCircle,
} from "lucide-react"
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav"

// Datos mock para finanzas
const financialSummary = {
  totalIngresos: 2450000,
  totalGastos: 1680000,
  utilidadNeta: 770000,
  flujoEfectivo: 890000,
  margenUtilidad: 31.4,
  crecimientoMensual: 12.5,
}

const ingresos = [
  { id: 1, fecha: "2024-01-15", concepto: "Venta de Ganado", categoria: "Ganadería", monto: 450000, estado: "Pagado" },
  { id: 2, fecha: "2024-01-12", concepto: "Venta de Leche", categoria: "Lácteos", monto: 125000, estado: "Pagado" },
  {
    id: 3,
    fecha: "2024-01-10",
    concepto: "Venta de Cultivos",
    categoria: "Agricultura",
    monto: 380000,
    estado: "Pendiente",
  },
  {
    id: 4,
    fecha: "2024-01-08",
    concepto: "Subsidio Gubernamental",
    categoria: "Subsidios",
    monto: 200000,
    estado: "Pagado",
  },
  { id: 5, fecha: "2024-01-05", concepto: "Venta de Huevos", categoria: "Avicultura", monto: 85000, estado: "Pagado" },
]

const gastos = [
  {
    id: 1,
    fecha: "2024-01-14",
    concepto: "Compra de Fertilizantes",
    categoria: "Insumos",
    monto: 180000,
    estado: "Pagado",
  },
  {
    id: 2,
    fecha: "2024-01-13",
    concepto: "Mantenimiento Tractores",
    categoria: "Mantenimiento",
    monto: 95000,
    estado: "Pagado",
  },
  { id: 3, fecha: "2024-01-11", concepto: "Salarios Personal", categoria: "Nómina", monto: 420000, estado: "Pagado" },
  { id: 4, fecha: "2024-01-09", concepto: "Combustible", categoria: "Operaciones", monto: 150000, estado: "Pendiente" },
  {
    id: 5,
    fecha: "2024-01-07",
    concepto: "Medicamentos Veterinarios",
    categoria: "Veterinaria",
    monto: 75000,
    estado: "Pagado",
  },
]

const presupuestos = [
  { categoria: "Insumos Agrícolas", presupuestado: 500000, gastado: 380000, porcentaje: 76 },
  { categoria: "Nómina", presupuestado: 600000, gastado: 420000, porcentaje: 70 },
  { categoria: "Mantenimiento", presupuestado: 200000, gastado: 165000, porcentaje: 82.5 },
  { categoria: "Combustible", presupuestado: 180000, gastado: 150000, porcentaje: 83.3 },
  { categoria: "Veterinaria", presupuestado: 120000, gastado: 95000, porcentaje: 79.2 },
]

export default function FinanzasPage() {
  const [filtroFecha, setFiltroFecha] = useState("mes")
  const [filtroCategoria, setFiltroCategoria] = useState("todas")

  const breadcrumbItems = [
    { label: "Dashboard", href: "/" },
    { label: "Finanzas", href: "/finanzas" },
  ]

  return (
    <div className="flex-1 space-y-6 p-6">
      <BreadcrumbNav items={breadcrumbItems} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión Financiera</h1>
          <p className="text-muted-foreground">Control completo de ingresos, gastos y presupuestos de la granja</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Transacción
          </Button>
        </div>
      </div>

      {/* KPIs Financieros */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${financialSummary.totalIngresos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1 text-green-500" />+{financialSummary.crecimientoMensual}% vs
              mes anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${financialSummary.totalGastos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 inline mr-1 text-red-500" />
              -5.2% vs mes anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${financialSummary.utilidadNeta.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Margen: {financialSummary.margenUtilidad}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flujo de Efectivo</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${financialSummary.flujoEfectivo.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Disponible para inversión</p>
          </CardContent>
        </Card>
      </div>

      {/* Contenido Principal */}
      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="presupuestos">Presupuestos</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Distribución de Ingresos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Ganadería</span>
                    <span className="text-sm font-medium">45%</span>
                  </div>
                  <Progress value={45} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Agricultura</span>
                    <span className="text-sm font-medium">35%</span>
                  </div>
                  <Progress value={35} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Lácteos</span>
                    <span className="text-sm font-medium">15%</span>
                  </div>
                  <Progress value={15} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Otros</span>
                    <span className="text-sm font-medium">5%</span>
                  </div>
                  <Progress value={5} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Distribución de Gastos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Nómina</span>
                    <span className="text-sm font-medium">40%</span>
                  </div>
                  <Progress value={40} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Insumos</span>
                    <span className="text-sm font-medium">25%</span>
                  </div>
                  <Progress value={25} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Mantenimiento</span>
                    <span className="text-sm font-medium">20%</span>
                  </div>
                  <Progress value={20} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Otros</span>
                    <span className="text-sm font-medium">15%</span>
                  </div>
                  <Progress value={15} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Alertas Financieras</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium">Presupuesto de Mantenimiento</p>
                    <p className="text-xs text-muted-foreground">Se ha utilizado el 82.5% del presupuesto mensual</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border border-blue-200 bg-blue-50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Pago Pendiente</p>
                    <p className="text-xs text-muted-foreground">Venta de cultivos por $380,000 pendiente de cobro</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingresos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registro de Ingresos</CardTitle>
              <CardDescription>Historial completo de ingresos de la granja</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <Input placeholder="Buscar transacciones..." className="w-64" />
                </div>
                <Select value={filtroFecha} onValueChange={setFiltroFecha}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semana">Esta semana</SelectItem>
                    <SelectItem value="mes">Este mes</SelectItem>
                    <SelectItem value="trimestre">Trimestre</SelectItem>
                    <SelectItem value="año">Este año</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingresos.map((ingreso) => (
                    <TableRow key={ingreso.id}>
                      <TableCell>{ingreso.fecha}</TableCell>
                      <TableCell className="font-medium">{ingreso.concepto}</TableCell>
                      <TableCell>{ingreso.categoria}</TableCell>
                      <TableCell className="text-green-600 font-medium">${ingreso.monto.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={ingreso.estado === "Pagado" ? "default" : "secondary"}>{ingreso.estado}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gastos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registro de Gastos</CardTitle>
              <CardDescription>Historial completo de gastos operativos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <Input placeholder="Buscar gastos..." className="w-64" />
                </div>
                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="insumos">Insumos</SelectItem>
                    <SelectItem value="nomina">Nómina</SelectItem>
                    <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                    <SelectItem value="operaciones">Operaciones</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastos.map((gasto) => (
                    <TableRow key={gasto.id}>
                      <TableCell>{gasto.fecha}</TableCell>
                      <TableCell className="font-medium">{gasto.concepto}</TableCell>
                      <TableCell>{gasto.categoria}</TableCell>
                      <TableCell className="text-red-600 font-medium">-${gasto.monto.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={gasto.estado === "Pagado" ? "default" : "secondary"}>{gasto.estado}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presupuestos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Control de Presupuestos</CardTitle>
              <CardDescription>Seguimiento del cumplimiento presupuestario por categoría</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {presupuestos.map((presupuesto, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{presupuesto.categoria}</span>
                      <span className="text-sm text-muted-foreground">
                        ${presupuesto.gastado.toLocaleString()} / ${presupuesto.presupuestado.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={presupuesto.porcentaje} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{presupuesto.porcentaje}% utilizado</span>
                      <span>Disponible: ${(presupuesto.presupuestado - presupuesto.gastado).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reportes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Reportes Disponibles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Calendar className="h-4 w-4 mr-2" />
                  Reporte Mensual
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Análisis de Rentabilidad
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <PieChart className="h-4 w-4 mr-2" />
                  Estado de Resultados
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Flujo de Caja
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configuración de Reportes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Período</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensual">Mensual</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Formato</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar formato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Generar Reporte
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
