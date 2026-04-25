"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wheat, ArrowLeft, Construction } from "lucide-react"
import { useRouter } from "next/navigation"

export default function CultivosPage() {
  const router = useRouter()

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wheat className="h-8 w-8 text-primary" />
            Cultivos
          </h1>
          <p className="text-muted-foreground mt-1">Gestión de cultivos y pasturas</p>
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
            Próximamente podrás gestionar pasturas, forrajes y cultivos de cobertura.
            Las pasturas ya se pueden registrar desde el módulo de Potreros (sectores con forraje).
          </p>
          <Button className="mt-4" onClick={() => router.push("/potreros")}>
            Ir a Potreros
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
