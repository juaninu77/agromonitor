"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, AlertTriangle, Camera, FileText, Calendar, MapPin, Cpu, Settings } from "lucide-react"

const quickActions = [
  {
    title: "Agregar Animal",
    description: "Registrar nuevo ganado",
    icon: Plus,
    color: "bg-green-500 hover:bg-green-600",
    href: "/ganado/nuevo",
  },
  {
    title: "Reportar Problema",
    description: "Crear reporte de incidencia",
    icon: AlertTriangle,
    color: "bg-red-500 hover:bg-red-600",
    href: "/reportes/nuevo",
  },
  {
    title: "Tomar Foto",
    description: "Capturar evidencia visual",
    icon: Camera,
    color: "bg-blue-500 hover:bg-blue-600",
    href: "/fotos/nueva",
  },
  {
    title: "Nuevo Reporte",
    description: "Generar reporte de campo",
    icon: FileText,
    color: "bg-purple-500 hover:bg-purple-600",
    href: "/reportes/campo",
  },
  {
    title: "Programar Tarea",
    description: "Agendar actividad",
    icon: Calendar,
    color: "bg-orange-500 hover:bg-orange-600",
    href: "/tareas/nueva",
  },
  {
    title: "Verificar Ubicación",
    description: "Revisar coordenadas GPS",
    icon: MapPin,
    color: "bg-teal-500 hover:bg-teal-600",
    href: "/mapa",
  },
  {
    title: "Control IoT",
    description: "Gestionar sensores",
    icon: Cpu,
    color: "bg-indigo-500 hover:bg-indigo-600",
    href: "/iot",
  },
  {
    title: "Configuración",
    description: "Ajustar parámetros",
    icon: Settings,
    color: "bg-gray-500 hover:bg-gray-600",
    href: "/configuracion",
  },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          Acciones Rápidas
        </CardTitle>
        <CardDescription>Accesos directos a funciones principales</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              className={`h-auto p-4 flex flex-col items-center gap-2 hover:scale-105 transition-all duration-200 ${action.color} text-white border-0`}
              onClick={() => {
                // Aquí iría la navegación o acción correspondiente
                console.log(`Navegando a: ${action.href}`)
              }}
            >
              <action.icon className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium text-sm">{action.title}</div>
                <div className="text-xs opacity-90">{action.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
