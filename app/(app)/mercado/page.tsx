"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, ArrowLeft, Construction } from "lucide-react"
import { useRouter } from "next/navigation"

export default function MercadoPage() {
  const router = useRouter()

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            Mercado
          </h1>
          <p className="text-muted-foreground mt-1">Precios y tendencias del mercado ganadero</p>
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
            Próximamente se integrarán datos de mercado en tiempo real con precios de referencia
            del Mercado de Liniers, Rosgan y remates locales.
          </p>
          <Button className="mt-4" onClick={() => router.push("/ventas")}>
            Ir a Ventas y Compras
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
