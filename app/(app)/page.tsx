"use client"

import { useQuery } from "@tanstack/react-query"
import { useTenant } from "@/lib/context/tenant-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  LayoutDashboard,
  Beef,
  Layers,
  Scale,
  Syringe,
  ShoppingCart,
  Baby,
  Building,
  Activity,
  Plus,
  ArrowRight,
  RefreshCw,
  Crosshair,
  Heart,
  Map,
} from "lucide-react"

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

async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch("/api/dashboard/stats")
  if (!res.ok) throw new Error("Error al cargar estadísticas")
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? "Error al cargar datos")
  return json.data
}

function KpiSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickActionSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 flex flex-col items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <Skeleton className="h-4 w-20" />
      </CardContent>
    </Card>
  )
}

const mainKpis = [
  {
    key: "totalAnimales",
    title: "Total Animales",
    icon: Beef,
    color: "text-green-600",
    bg: "bg-green-100",
  },
  {
    key: "totalLotes",
    title: "Total Lotes",
    icon: Layers,
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  {
    key: "pesadasRecientes",
    title: "Pesadas del mes",
    icon: Scale,
    color: "text-amber-600",
    bg: "bg-amber-100",
  },
  {
    key: "eventsSanidadMes",
    title: "Sanidad del mes",
    icon: Syringe,
    color: "text-purple-600",
    bg: "bg-purple-100",
  },
] as const

const quickActions = [
  {
    label: "Registrar animal",
    icon: Plus,
    href: "/ganado",
    color: "bg-green-600 hover:bg-green-700",
  },
  {
    label: "Sesión de manga",
    icon: Crosshair,
    href: "/manga",
    color: "bg-blue-600 hover:bg-blue-700",
  },
  {
    label: "Aplicar sanidad",
    icon: Heart,
    href: "/sanidad",
    color: "bg-purple-600 hover:bg-purple-700",
  },
  {
    label: "Registrar peso",
    icon: Scale,
    href: "/ganado",
    color: "bg-amber-600 hover:bg-amber-700",
  },
  {
    label: "Ver potreros",
    icon: Map,
    href: "/potreros",
    color: "bg-emerald-600 hover:bg-emerald-700",
  },
]

export default function DashboardPage() {
  const { establecimientoActivo } = useTenant()

  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", establecimientoActivo?.id],
    queryFn: fetchDashboardStats,
    enabled: !!establecimientoActivo,
  })

  const tasaActividad =
    stats && stats.totalAnimales > 0
      ? Math.round((stats.pesadasRecientes / stats.totalAnimales) * 100)
      : 0

  if (isLoading || !establecimientoActivo) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <QuickActionSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {error instanceof Error ? error.message : "Error desconocido"}
            </p>
            <Button onClick={() => refetch()}>Reintentar</Button>
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
            <p className="text-muted-foreground mt-1">
              {establecimientoActivo.nombre}
            </p>
          </div>
        </div>
        <EmptyState
          totalAnimales={stats.totalAnimales}
          totalEstablecimientos={stats.totalEstablecimientos}
          totalLotes={stats.totalLotes}
        />
      </div>
    )
  }

  const secondaryKpis = [
    {
      title: "Ventas del mes",
      value: stats.ventasMes,
      icon: ShoppingCart,
      color: "text-teal-600",
      bg: "bg-teal-100",
    },
    {
      title: "Partos próximos",
      value: stats.paricionesProximas,
      icon: Baby,
      color: "text-pink-600",
      bg: "bg-pink-100",
    },
    {
      title: "Establecimientos",
      value: stats.totalEstablecimientos,
      icon: Building,
      color: "text-slate-600",
      bg: "bg-slate-100",
    },
    {
      title: "Tasa actividad",
      value: `${tasaActividad}%`,
      icon: Activity,
      color: "text-orange-600",
      bg: "bg-orange-100",
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            Panel de Control
          </h1>
          <p className="text-muted-foreground mt-1">
            {establecimientoActivo.nombre}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="self-start rounded-xl border hover:border-border"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mainKpis.map((kpi) => (
          <Card key={kpi.key}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">
                    {stats[kpi.key]}
                  </p>
                  <p className="text-xs text-muted-foreground">{kpi.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {secondaryKpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums">
                    {kpi.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{kpi.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.paricionesProximas > 0 && (
        <Card className="border-pink-200 bg-pink-50/60">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Baby className="h-6 w-6 text-pink-600 shrink-0" />
              <div>
                <p className="font-semibold text-pink-900">
                  {stats.paricionesProximas} pariciones esperadas esta semana
                </p>
                <p className="text-sm text-pink-700">
                  Vacas con fecha probable de parto en los próximos 7 días
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-pink-300 text-pink-700 hover:bg-pink-100 shrink-0"
            >
              <Link href="/reproduccion">
                Ver detalle
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Acciones rápidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <Card className="cursor-pointer hover:scale-[1.03] transition-transform h-full">
                <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
                  <div
                    className={`p-3 rounded-xl ${action.color} text-white`}
                  >
                    <action.icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
