"use client"

import { useState, useEffect, useCallback } from "react"
import { DataTable, type ColumnDef } from "@/components/ui/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTenant } from "@/lib/context/tenant-context"
import {
  ClipboardList,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Flag,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

// ============================================
// TIPOS
// ============================================

interface Tarea {
  id: string
  titulo: string
  descripcion: string | null
  tipo: string
  estado: string
  prioridad: string
  fechaLimite: string | null
  fechaCompletada: string | null
  observ: string | null
  createdAt: string
  asignadoA: { id: string; nombre: string; apellido: string } | null
  establecimiento: { id: string; nombre: string }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// ============================================
// MAPAS DE COLORES Y ETIQUETAS
// ============================================

const PRIORIDAD_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  baja: { label: "Baja", variant: "secondary", className: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
  media: { label: "Media", variant: "default", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  alta: { label: "Alta", variant: "default", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  urgente: { label: "Urgente", variant: "destructive", className: "bg-red-100 text-red-700 hover:bg-red-100" },
}

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  en_progreso: { label: "En Progreso", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  completada: { label: "Completada", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  cancelada: { label: "Cancelada", className: "bg-gray-100 text-gray-600 hover:bg-gray-100" },
}

const TIPO_CONFIG: Record<string, string> = {
  sanitario: "Sanitario",
  mantenimiento: "Mantenimiento",
  movimiento: "Movimiento",
  general: "General",
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function TareasPage() {
  const { establecimientoActivo } = useTenant()

  const [tareas, setTareas] = useState<Tarea[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tabEstado, setTabEstado] = useState("todas")
  const [filtroPrioridad, setFiltroPrioridad] = useState("todas")
  const [filtroTipo, setFiltroTipo] = useState("todos")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estado del formulario de creación
  const [formData, setFormData] = useState({
    titulo: "",
    descripcion: "",
    tipo: "general",
    prioridad: "media",
    fechaLimite: "",
    observ: "",
  })

  // ============================================
  // FETCH TAREAS
  // ============================================

  const fetchTareas = useCallback(async (page = 1) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", "25")

      if (establecimientoActivo) {
        params.set("establecimientoId", establecimientoActivo.id)
      }
      if (tabEstado !== "todas") {
        params.set("estado", tabEstado)
      }
      if (filtroPrioridad !== "todas") {
        params.set("prioridad", filtroPrioridad)
      }
      if (filtroTipo !== "todos") {
        params.set("tipo", filtroTipo)
      }

      const response = await fetch(`/api/tareas?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setTareas(result.data)
        setPagination(result.pagination)
      } else {
        toast.error("Error al cargar tareas")
      }
    } catch {
      toast.error("Error de conexión al cargar tareas")
    } finally {
      setIsLoading(false)
    }
  }, [establecimientoActivo, tabEstado, filtroPrioridad, filtroTipo])

  useEffect(() => {
    fetchTareas()
  }, [fetchTareas])

  // ============================================
  // CREAR TAREA
  // ============================================

  const handleCreate = async () => {
    if (!formData.titulo.trim()) {
      toast.error("El título es obligatorio")
      return
    }
    if (!establecimientoActivo) {
      toast.error("Selecciona un establecimiento primero")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/tareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          establecimientoId: establecimientoActivo.id,
          fechaLimite: formData.fechaLimite || undefined,
          descripcion: formData.descripcion || undefined,
          observ: formData.observ || undefined,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success("Tarea creada exitosamente")
        setDialogOpen(false)
        resetForm()
        fetchTareas()
      } else {
        toast.error(result.error || "Error al crear tarea")
      }
    } catch {
      toast.error("Error de conexión al crear tarea")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ============================================
  // COMPLETAR TAREA
  // ============================================

  const handleComplete = async (tareaId: string) => {
    try {
      const response = await fetch(`/api/tareas/${tareaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "completada" }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success("Tarea completada")
        fetchTareas()
      } else {
        toast.error(result.error || "Error al completar tarea")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  // ============================================
  // ELIMINAR TAREA
  // ============================================

  const handleDelete = async (tareaId: string) => {
    try {
      const response = await fetch(`/api/tareas/${tareaId}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.success) {
        toast.success("Tarea eliminada")
        fetchTareas()
      } else {
        toast.error(result.error || "Error al eliminar tarea")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  const resetForm = () => {
    setFormData({
      titulo: "",
      descripcion: "",
      tipo: "general",
      prioridad: "media",
      fechaLimite: "",
      observ: "",
    })
  }

  // ============================================
  // COLUMNAS DE LA TABLA
  // ============================================

  const columns: ColumnDef<Tarea>[] = [
    {
      id: "titulo",
      header: "Título",
      accessorFn: (row) => (
        <div>
          <p className="font-medium">{row.titulo}</p>
          {row.descripcion && (
            <p className="text-xs text-muted-foreground line-clamp-1">{row.descripcion}</p>
          )}
        </div>
      ),
    },
    {
      id: "tipo",
      header: "Tipo",
      accessorFn: (row) => (
        <Badge variant="outline">{TIPO_CONFIG[row.tipo] || row.tipo}</Badge>
      ),
    },
    {
      id: "prioridad",
      header: "Prioridad",
      accessorFn: (row) => {
        const config = PRIORIDAD_CONFIG[row.prioridad]
        return config ? (
          <Badge className={config.className}>
            <Flag className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
        ) : (
          <Badge variant="secondary">{row.prioridad}</Badge>
        )
      },
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (row) => {
        const config = ESTADO_CONFIG[row.estado]
        return config ? (
          <Badge className={config.className}>{config.label}</Badge>
        ) : (
          <Badge variant="secondary">{row.estado}</Badge>
        )
      },
    },
    {
      id: "asignadoA",
      header: "Asignado a",
      accessorFn: (row) =>
        row.asignadoA
          ? `${row.asignadoA.nombre} ${row.asignadoA.apellido}`
          : "Sin asignar",
    },
    {
      id: "fechaLimite",
      header: "Fecha Límite",
      accessorFn: (row) => {
        if (!row.fechaLimite) return "—"
        const fecha = new Date(row.fechaLimite)
        const hoy = new Date()
        const vencida = fecha < hoy && row.estado !== "completada" && row.estado !== "cancelada"
        return (
          <span className={vencida ? "text-red-600 font-medium" : ""}>
            {fecha.toLocaleDateString("es-AR")}
          </span>
        )
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      accessorFn: (row) => (
        <div className="flex items-center gap-1">
          {row.estado !== "completada" && row.estado !== "cancelada" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => {
                e.stopPropagation()
                handleComplete(row.id)
              }}
              title="Marcar como completada"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(row.id)
            }}
            title="Eliminar tarea"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  // ============================================
  // CONTADORES PARA TABS
  // ============================================

  const contarPorEstado = (estado: string) =>
    tareas.filter((t) => t.estado === estado).length

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            Tareas y Ordenes de Trabajo
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona las tareas del establecimiento
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Tarea
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Nueva Tarea</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Título */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Título *</label>
                <Input
                  placeholder="Ej: Vacunación lote norte"
                  value={formData.titulo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, titulo: e.target.value }))
                  }
                />
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  placeholder="Detalles de la tarea..."
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, descripcion: e.target.value }))
                  }
                  rows={3}
                />
              </div>

              {/* Tipo y Prioridad en fila */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo</label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, tipo: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="sanitario">Sanitario</SelectItem>
                      <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                      <SelectItem value="movimiento">Movimiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Prioridad</label>
                  <Select
                    value={formData.prioridad}
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, prioridad: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baja">Baja</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fecha Límite */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha Límite</label>
                <Input
                  type="date"
                  value={formData.fechaLimite}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, fechaLimite: e.target.value }))
                  }
                />
              </div>

              {/* Observaciones */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Observaciones</label>
                <Textarea
                  placeholder="Notas adicionales..."
                  value={formData.observ}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, observ: e.target.value }))
                  }
                  rows={2}
                />
              </div>

              {/* Botón Crear */}
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={isSubmitting || !formData.titulo.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Tarea
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumen rápido */}
      {!isLoading && pagination && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-1">
                <Clock className="h-4 w-4" /> Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contarPorEstado("pendiente")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> En Progreso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contarPorEstado("en_progreso")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Completadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contarPorEstado("completada")}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros y tabla */}
      <Card>
        <CardContent className="pt-6">
          <Tabs
            value={tabEstado}
            onValueChange={(val) => setTabEstado(val)}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
              <TabsList>
                <TabsTrigger value="todas">Todas</TabsTrigger>
                <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
                <TabsTrigger value="en_progreso">En Progreso</TabsTrigger>
                <TabsTrigger value="completada">Completadas</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Select
                  value={filtroPrioridad}
                  onValueChange={setFiltroPrioridad}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Toda prioridad</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filtroTipo}
                  onValueChange={setFiltroTipo}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todo tipo</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="sanitario">Sanitario</SelectItem>
                    <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                    <SelectItem value="movimiento">Movimiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </Tabs>

          <DataTable
            columns={columns}
            data={tareas}
            isLoading={isLoading}
            emptyMessage="No se encontraron tareas"
            pagination={pagination ?? undefined}
            onPageChange={(page) => fetchTareas(page)}
            rowKey={(row) => row.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
