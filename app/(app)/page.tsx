"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import {
  RefreshCw,
  LayoutDashboard,
  Loader2,
  Bot,
  LandPlot,
  Droplets,
  Syringe,
  ShoppingCart,
  Scale,
  Heart,
  Plus,
  MapPin,
  Baby,
  ArrowRight,
} from "lucide-react"
import { useRouter } from "next/navigation"

interface DashboardStats {
  totalAnimales: number
  totalEstablecimientos: number
  totalLotes: number
  tieneDatos: boolean
  eventsSanidadMes: number
  ventasMes: number
  pesadasRecientes: number
  paricionesProximas: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch("/api/dashboard/stats")
      if (!response.ok) throw new Error("Error al cargar estadísticas")
      const data = await response.json()
      if (data.success) {
        setStats(data.data)
      } else {
        throw new Error(data.error || "Error al cargar datos")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchStats} className="mt-4">Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!stats) return null

  if (!stats.tieneDatos) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <LayoutDashboard className="h-8 w-8 text-primary" />
              Panel de Control
            </h1>
            <p className="text-muted-foreground mt-1">Bienvenido a AgroMonitor</p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchStats} className="rounded-xl border-2 border-transparent hover:border-border">
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
        <EmptyState totalAnimales={stats.totalAnimales} totalEstablecimientos={stats.totalEstablecimientos} totalLotes={stats.totalLotes} />
      </div>
    )
  }

  const kpis = [
    { title: "Total Animales", value: stats.totalAnimales, icon: Bot, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Establecimientos", value: stats.totalEstablecimientos, icon: LandPlot, color: "text-green-600", bg: "bg-green-50" },
    { title: "Lotes", value: stats.totalLotes, icon: Droplets, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "Sanidad (mes)", value: stats.eventsSanidadMes, icon: Syringe, color: "text-orange-600", bg: "bg-orange-50" },
    { title: "Ventas (mes)", value: stats.ventasMes, icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Pesadas (30d)", value: stats.pesadasRecientes, icon: Scale, color: "text-cyan-600", bg: "bg-cyan-50" },
  ]

  const quickActions = [
    { label: "Registrar Animal", icon: Plus, href: "/ganado", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    { label: "Pesada Rápida", icon: Scale, href: "/ganado", color: "bg-blue-600 hover:bg-blue-700 text-white" },
    { label: "Evento Sanitario", icon: Syringe, href: "/sanidad", color: "bg-purple-600 hover:bg-purple-700 text-white" },
    { label: "Registrar Parición", icon: Baby, href: "/reproduccion", color: "bg-pink-600 hover:bg-pink-700 text-white" },
    { label: "Mover Animales", icon: MapPin, href: "/potreros", color: "bg-orange-600 hover:bg-orange-700 text-white" },
    { label: "Registrar Venta", icon: ShoppingCart, href: "/ventas", color: "bg-teal-600 hover:bg-teal-700 text-white" },
  ]

  const sections = [
    { title: "Ganado", description: "Gestión del rodeo", icon: Bot, href: "/ganado", count: `${stats.totalAnimales} cabezas` },
    { title: "Sanidad", description: "Vacunaciones y tratamientos", icon: Syringe, href: "/sanidad", count: `${stats.eventsSanidadMes} este mes` },
    { title: "Reproducción", description: "Ciclo reproductivo", icon: Heart, href: "/reproduccion", count: `${stats.paricionesProximas} próximas` },
    { title: "Potreros", description: "Sectores y movimientos", icon: MapPin, href: "/potreros", count: "" },
    { title: "Ventas y Compras", description: "Transacciones", icon: ShoppingCart, href: "/ventas", count: `${stats.ventasMes} ventas/mes` },
    { title: "Configuración", description: "Establecimientos y lotes", icon: LandPlot, href: "/configuracion/establecimientos", count: `${stats.totalEstablecimientos} estab.` },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            Panel de Control
          </h1>
          <p className="text-muted-foreground mt-1">Resumen de tu operación ganadera</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchStats} className="rounded-xl border-2 border-transparent hover:border-border">
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="border-2 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertas importantes */}
      {stats.paricionesProximas > 0 && (
        <Card className="border-2 border-pink-200 bg-pink-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Baby className="h-6 w-6 text-pink-600" />
              <div>
                <p className="font-semibold text-pink-900">
                  {stats.paricionesProximas} pariciones esperadas esta semana
                </p>
                <p className="text-sm text-pink-700">Vacas con fecha probable de parto en los próximos 7 días</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push("/reproduccion")} className="border-pink-300 text-pink-700 hover:bg-pink-100">
              Ver detalle
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Acciones Rápidas */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                className={`h-auto py-4 flex flex-col items-center gap-2 ${action.color} shadow-sm`}
                onClick={() => router.push(action.href)}
              >
                <action.icon className="h-6 w-6" />
                <span className="text-xs font-medium text-center">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Módulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
          <Card
            key={section.title}
            className="border-2 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all"
            onClick={() => router.push(section.href)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <section.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{section.title}</h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
              {section.count && (
                <p className="text-sm text-muted-foreground mt-3 pl-12">{section.count}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
