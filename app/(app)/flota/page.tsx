import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { vehicles } from "@/lib/mocks"
import { BreadcrumbNav } from "@/components/dashboard/breadcrumb-nav"
import {
  Plus,
  Filter,
  Download,
  Settings,
  Fuel,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wrench,
} from "lucide-react"

const getStatusIcon = (status: string) => {
  switch (status) {
    case "active":
      return <CheckCircle className="h-4 w-4 text-status-ok" />
    case "maintenance":
      return <Wrench className="h-4 w-4 text-status-warn" />
    case "inactive":
      return <XCircle className="h-4 w-4 text-muted-foreground" />
    default:
      return <CheckCircle className="h-4 w-4 text-status-ok" />
  }
}

const getStatusClass = (status: string) => {
  switch (status) {
    case "active":
      return "status-online"
    case "maintenance":
      return "status-warning"
    case "inactive":
      return "status-offline"
    default:
      return "status-online"
  }
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case "tractor":
      return "Tractor"
    case "harvester":
      return "Cosechadora"
    case "truck":
      return "Camión"
    case "sprayer":
      return "Pulverizadora"
    default:
      return type
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case "active":
      return "Activo"
    case "maintenance":
      return "Mantenimiento"
    case "inactive":
      return "Inactivo"
    default:
      return status
  }
}

export default function FleetPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* Breadcrumb Navigation */}
      <BreadcrumbNav />

      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestión de Flota</h1>
          <p className="text-muted-foreground">Administra y monitorea todos los vehículos y maquinaria de la finca</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="rounded-xl bg-transparent border-2">
            <Filter className="mr-2 h-4 w-4" />
            Filtrar
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl bg-transparent border-2">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl bg-transparent border-2">
            <Settings className="mr-2 h-4 w-4" />
            Configurar
          </Button>
          <Button size="sm" className="rounded-xl border-2">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Vehículo
          </Button>
        </div>
      </div>

      {/* Fleet Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-border hover:border-primary/30 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Vehículos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground mb-2">{vehicles.length}</div>
            <div className="flex items-center gap-2">
              <Badge className="status-online">{vehicles.filter((v) => v.status === "active").length} Activos</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border hover:border-primary/30 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">En Mantenimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground mb-2">
              {vehicles.filter((v) => v.status === "maintenance").length}
            </div>
            <div className="flex items-center gap-2">
              <Badge className="status-warning">Requiere Atención</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border hover:border-primary/30 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Combustible Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground mb-2">
              {Math.round(vehicles.reduce((acc, v) => acc + v.fuelLevel, 0) / vehicles.length)}%
            </div>
            <div className="flex items-center gap-2">
              <Badge className="status-online">Nivel Óptimo</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border hover:border-primary/30 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Próximos Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground mb-2">2</div>
            <div className="flex items-center gap-2">
              <Badge className="status-warning">Esta Semana</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle List */}
      <div className="grid gap-6">
        <Card className="border-2 border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Lista de Vehículos</CardTitle>
            <p className="text-sm text-muted-foreground">Estado actual de toda la flota</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="p-4 rounded-lg border-2 border-border hover:bg-muted/30 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                        {getStatusIcon(vehicle.status)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{vehicle.name}</h3>
                        <p className="text-sm text-muted-foreground">{getTypeLabel(vehicle.type)}</p>
                      </div>
                    </div>
                    <Badge className={getStatusClass(vehicle.status)}>{getStatusLabel(vehicle.status)}</Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div className="flex items-center gap-2 p-2 rounded border border-border/50">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Ubicación</p>
                        <p className="text-sm font-medium">{vehicle.location}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded border border-border/50">
                      <Fuel className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Combustible</p>
                        <p className="text-sm font-medium">{vehicle.fuelLevel}%</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded border border-border/50">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Horas Trabajadas</p>
                        <p className="text-sm font-medium">
                          {vehicle.hoursWorked}/{vehicle.maxHours}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded border border-border/50">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Operador</p>
                        <p className="text-sm font-medium">{vehicle.driver}</p>
                      </div>
                    </div>
                  </div>

                  {vehicle.issues.length > 0 && (
                    <div className="p-3 rounded-lg bg-status-warn/10 border border-status-warn/30">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-status-warn" />
                        <span className="text-sm font-medium text-status-warn">Problemas Reportados:</span>
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {vehicle.issues.map((issue, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <div className="w-1 h-1 bg-status-warn rounded-full"></div>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-border/50">
                    <div className="text-sm text-muted-foreground">
                      Último mantenimiento: {new Date(vehicle.lastMaintenance).toLocaleDateString("es-ES")}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="border-2 bg-transparent">
                        Ver Detalles
                      </Button>
                      <Button variant="outline" size="sm" className="border-2 bg-transparent">
                        Programar Servicio
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
