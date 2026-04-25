"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckSquare, ArrowLeft, Construction } from "lucide-react"
import { useRouter } from "next/navigation"

export default function TareasPage() {
  const router = useRouter()

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-primary" />
            Tareas
          </h1>
          <p className="text-muted-foreground mt-1">Gestión de tareas y pendientes</p>
        </div>
      </div>

      <Card className="border-2 border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <Construction className="h-5 w-5" />
            Módulo en Desarrollo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-amber-800">
            Próximamente podrás crear y asignar tareas, establecer prioridades y fechas
            de vencimiento. Las tareas se generarán automáticamente desde eventos del
            sistema (vacunaciones pendientes, tactos programados, etc.).
          </p>
          <Button className="mt-4" onClick={() => router.push("/")}>
            Volver al Panel
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
