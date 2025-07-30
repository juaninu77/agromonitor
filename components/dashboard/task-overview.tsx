"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { tasks } from "@/lib/mocks"
import { Calendar, Clock, User, MapPin, ArrowRight, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

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

export function TaskOverview() {
  const urgentTasks = tasks.filter((task) => task.priority === "urgent" || task.status === "overdue").slice(0, 4)
  const completedTasks = tasks.filter((task) => task.status === "completed").length
  const totalTasks = tasks.length
  const completionRate = Math.round((completedTasks / totalTasks) * 100)

  return (
    <Card className="border-2 border-border hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Resumen de Tareas
          <div className="ml-auto flex items-center gap-2">
            <Badge className="status-online">
              {completedTasks}/{totalTasks}
            </Badge>
            <span className="text-xs text-muted-foreground">Completadas</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Overview */}
        <div className="p-3 rounded-lg border-2 border-border/50 bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progreso General</span>
            <span className="text-sm font-bold">{completionRate}%</span>
          </div>
          <Progress value={completionRate} className="h-2" />
        </div>

        {/* Urgent Tasks */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Tareas Urgentes
          </h4>

          {urgentTasks.map((task) => (
            <div
              key={task.id}
              className="p-3 rounded-lg border-2 border-border/50 hover:bg-muted/30 hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-xs font-bold border-2", getPriorityColor(task.priority))}>
                    {getPriorityLabel(task.priority)}
                  </Badge>
                  <Badge className={cn("status-indicator", getStatusColor(task.status))}>
                    {getStatusLabel(task.status)}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{task.dueDate}</span>
              </div>

              <h5 className="font-medium text-foreground mb-1">{task.title}</h5>
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{task.description}</p>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{task.assignedTo}</span>
                  </div>
                  {task.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>{task.location}</span>
                    </div>
                  )}
                  {task.estimatedHours && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{task.estimatedHours}h</span>
                    </div>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="h-6 text-xs border border-transparent hover:border-border">
                  Ver
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t-2 border-border">
          <Button variant="ghost" className="w-full text-sm border-2 border-transparent hover:border-border">
            Ver Todas las Tareas
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
