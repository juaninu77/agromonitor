"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { tasks } from "@/lib/mocks"
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Plus,
  Search,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Timer,
  Users,
  BarChart3,
  Grid3X3,
  List,
  Eye,
  Edit,
  Trash2,
  Play,
  Pause,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "status-online"
    case "in-progress":
      return "status-warning"
    case "overdue":
      return "status-critical"
    default:
      return "status-offline"
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "urgent":
      return "text-red-600 bg-red-100 border-red-300"
    case "high":
      return "text-orange-600 bg-orange-100 border-orange-300"
    case "medium":
      return "text-yellow-600 bg-yellow-100 border-yellow-300"
    case "low":
      return "text-blue-600 bg-blue-100 border-blue-300"
    default:
      return "text-gray-600 bg-gray-100 border-gray-300"
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case "pending":
      return "Pendiente"
    case "in-progress":
      return "En Progreso"
    case "completed":
      return "Completada"
    case "overdue":
      return "Vencida"
    default:
      return status
  }
}

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case "urgent":
      return "URGENTE"
    case "high":
      return "ALTA"
    case "medium":
      return "MEDIA"
    case "low":
      return "BAJA"
    default:
      return priority.toUpperCase()
  }
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Sanidad Animal":
      return "🐄"
    case "Mantenimiento":
      return "🔧"
    case "Agricultura":
      return "🌾"
    case "Flota":
      return "🚜"
    default:
      return "📋"
  }
}

export default function TasksPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortBy, setSortBy] = useState("dueDate")
  const [viewMode, setViewMode] = useState("list")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Filtrar y ordenar tareas
  const filteredTasks = tasks
    .filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || task.status === statusFilter
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter
      const matchesCategory = categoryFilter === "all" || task.category === categoryFilter

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "dueDate":
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        case "priority":
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        case "title":
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })

  // Estadísticas
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((task) => task.status === "completed").length
  const inProgressTasks = tasks.filter((task) => task.status === "in-progress").length
  const overdueTasks = tasks.filter((task) => task.status === "overdue").length
  const urgentTasks = tasks.filter((task) => task.priority === "urgent").length
  const completionRate = Math.round((completedTasks / totalTasks) * 100)

  // Agrupar tareas por estado para vista Kanban
  const tasksByStatus = {
    pending: tasks.filter((task) => task.status === "pending"),
    "in-progress": tasks.filter((task) => task.status === "in-progress"),
    completed: tasks.filter((task) => task.status === "completed"),
    overdue: tasks.filter((task) => task.status === "overdue"),
  }

  const TaskCard = ({ task, isKanban = false }) => (
    <Card
      className={cn(
        "border-2 border-border hover:border-primary/30 transition-all duration-200",
        isKanban ? "mb-3" : "mb-4",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getCategoryIcon(task.category)}</span>
            <Badge className={cn("text-xs font-bold border-2", getPriorityColor(task.priority))}>
              {getPriorityLabel(task.priority)}
            </Badge>
            <Badge className={cn("status-indicator", getStatusColor(task.status))}>{getStatusLabel(task.status)}</Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                Ver Detalles
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              {task.status === "pending" && (
                <DropdownMenuItem>
                  <Play className="mr-2 h-4 w-4" />
                  Iniciar
                </DropdownMenuItem>
              )}
              {task.status === "in-progress" && (
                <DropdownMenuItem>
                  <Pause className="mr-2 h-4 w-4" />
                  Pausar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Marcar Completada
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{task.title}</h3>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{task.dueDate}</span>
              </div>
              {task.estimatedHours && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{task.estimatedHours}h</span>
                </div>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              {task.category}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{task.assignedTo}</span>
              </div>
              {task.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{task.location}</span>
                </div>
              )}
            </div>
            {task.status === "in-progress" && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-yellow-600">En curso</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const KanbanColumn = ({ title, status, tasks, icon: Icon, color }) => (
    <div className="flex-1 min-w-80">
      <div className={cn("p-3 rounded-lg border-2 mb-4", color)}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-5 w-5" />
          <h3 className="font-semibold">{title}</h3>
          <Badge variant="secondary" className="ml-auto">
            {tasks.length}
          </Badge>
        </div>
      </div>
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} isKanban={true} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Tareas</h1>
          <p className="text-muted-foreground">Administra y supervisa todas las tareas de la finca</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Tarea
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nueva Tarea</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" placeholder="Título de la tarea" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sanidad">Sanidad Animal</SelectItem>
                      <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                      <SelectItem value="agricultura">Agricultura</SelectItem>
                      <SelectItem value="flota">Flota</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" placeholder="Descripción detallada de la tarea" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgente</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="low">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignee">Asignado a</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar persona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="carlos">Carlos Mendoza</SelectItem>
                      <SelectItem value="ana">Ana García</SelectItem>
                      <SelectItem value="miguel">Miguel Torres</SelectItem>
                      <SelectItem value="luis">Luis Rodríguez</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours">Horas Estimadas</Label>
                  <Input id="hours" type="number" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Fecha Límite</Label>
                  <Input id="dueDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Ubicación</Label>
                  <Input id="location" placeholder="Ubicación de la tarea" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(false)}>Crear Tarea</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-2 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{totalTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completadas</p>
                <p className="text-2xl font-bold">{completedTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Timer className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En Progreso</p>
                <p className="text-2xl font-bold">{inProgressTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vencidas</p>
                <p className="text-2xl font-bold">{overdueTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Progreso</p>
                <p className="text-2xl font-bold">{completionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y Búsqueda */}
      <Card className="border-2 border-border">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tareas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in-progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="overdue">Vencida</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las prioridades</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  <SelectItem value="Sanidad Animal">Sanidad Animal</SelectItem>
                  <SelectItem value="Mantenimiento">Mantenimiento</SelectItem>
                  <SelectItem value="Agricultura">Agricultura</SelectItem>
                  <SelectItem value="Flota">Flota</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">Fecha límite</SelectItem>
                  <SelectItem value="priority">Prioridad</SelectItem>
                  <SelectItem value="title">Título</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex border-2 border-border rounded-lg">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-r-none border-r"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                  className="rounded-l-none"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vista de Progreso General */}
      <Card className="border-2 border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Progreso General
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Completadas</span>
              <span className="text-sm font-bold">
                {completedTasks}/{totalTasks}
              </span>
            </div>
            <Progress value={completionRate} className="h-3" />
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-600">{tasks.filter((t) => t.status === "pending").length}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{inProgressTasks}</p>
                <p className="text-xs text-muted-foreground">En Progreso</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{completedTasks}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{overdueTasks}</p>
                <p className="text-xs text-muted-foreground">Vencidas</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vista de Tareas */}
      {viewMode === "list" ? (
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <Card className="border-2 border-border">
              <CardContent className="p-8 text-center">
                <div className="text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No se encontraron tareas</p>
                  <p className="text-sm">Intenta ajustar los filtros o crear una nueva tarea</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredTasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </div>
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-4">
          <KanbanColumn
            title="Pendientes"
            status="pending"
            tasks={tasksByStatus.pending}
            icon={Clock}
            color="border-gray-300 bg-gray-50"
          />
          <KanbanColumn
            title="En Progreso"
            status="in-progress"
            tasks={tasksByStatus["in-progress"]}
            icon={Timer}
            color="border-yellow-300 bg-yellow-50"
          />
          <KanbanColumn
            title="Completadas"
            status="completed"
            tasks={tasksByStatus.completed}
            icon={CheckCircle2}
            color="border-green-300 bg-green-50"
          />
          <KanbanColumn
            title="Vencidas"
            status="overdue"
            tasks={tasksByStatus.overdue}
            icon={AlertCircle}
            color="border-red-300 bg-red-50"
          />
        </div>
      )}
    </div>
  )
}
