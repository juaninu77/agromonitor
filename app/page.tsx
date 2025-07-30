import { KpiCard } from "@/components/dashboard/kpi-card"
import { kpiData } from "@/lib/mocks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SparklineChart } from "@/components/dashboard/sparkline-chart"
import { EnhancedWeather } from "@/components/dashboard/enhanced-weather"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { SystemStatus } from "@/components/dashboard/system-status"
import { LiveMetrics } from "@/components/dashboard/live-metrics"
import { PriorityAlerts } from "@/components/dashboard/priority-alerts"
import { TaskOverview } from "@/components/dashboard/task-overview"
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav"
import { Button } from "@/components/ui/button"
import { Download, Plus, Filter, RefreshCw, Settings, LayoutDashboard } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb Navigation */}
      <BreadcrumbNav />

      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            Panel de Control Inteligente
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitoreo en tiempo real y gestión integral de tu operación agrícola
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="rounded-xl border-2 border-transparent hover:border-border">
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl bg-transparent border-2">
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl bg-transparent border-2">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl bg-transparent border-2">
            <Settings className="mr-2 h-4 w-4" />
            Personalizar
          </Button>
          <Button size="sm" className="rounded-xl border-2">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Widget
          </Button>
        </div>
      </div>

      {/* KPI Cards - Now with enhanced borders and hover effects */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <KpiCard key={kpi.title} data={kpi} />
        ))}
      </div>

      {/* Main Dashboard Grid - Reorganized for better UX */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column - Primary Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Financial Chart - Most important for decision making */}
          <Card className="border-2 border-border hover:border-primary/30 transition-colors">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                Análisis Financiero
                <div className="ml-auto flex items-center gap-1">
                  <div className="w-2 h-2 bg-status-ok rounded-full pulse-dot border border-status-ok/30"></div>
                  <span className="text-xs text-muted-foreground">Tiempo Real</span>
                </div>
              </CardTitle>
              <p className="text-sm text-muted-foreground">Flujo de efectivo y tendencias de los últimos 7 días</p>
            </CardHeader>
            <CardContent className="pl-2">
              <SparklineChart />
            </CardContent>
          </Card>

          {/* Secondary Widgets Row */}
          <div className="grid gap-6 md:grid-cols-2">
            <EnhancedWeather />
            <LiveMetrics />
          </div>
        </div>

        {/* Right Column - Action Items & Alerts */}
        <div className="lg:col-span-4 space-y-6">
          {/* Priority Alerts - Most critical information first */}
          <PriorityAlerts />

          {/* Task Overview - Action items */}
          <TaskOverview />

          {/* Quick Actions - Easy access to common tasks */}
          <QuickActions />

          {/* System Status - Technical information last */}
          <SystemStatus />
        </div>
      </div>

      {/* Bottom Section - Additional Insights */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-2 border-border hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Productividad Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-ok">+12.5%</div>
            <p className="text-sm text-muted-foreground">Comparado con la semana anterior</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-border hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Eficiencia Energética</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">87.3%</div>
            <p className="text-sm text-muted-foreground">Uso óptimo de recursos</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-border hover:border-primary/30 transition-colors">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Próxima Cosecha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-warn">15 días</div>
            <p className="text-sm text-muted-foreground">Maíz - Sector Norte</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
