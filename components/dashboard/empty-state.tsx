"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Bot, 
  MapPin, 
  List, 
  Plus, 
  ArrowRight,
  Sparkles,
  BookOpen
} from "lucide-react"
import Link from "next/link"

interface EmptyStateProps {
  totalAnimales: number
  totalEstablecimientos: number
  totalLotes: number
}

export function EmptyState({ totalAnimales, totalEstablecimientos, totalLotes }: EmptyStateProps) {
  const isCompletamenteVacio = totalAnimales === 0 && totalEstablecimientos === 0 && totalLotes === 0

  if (isCompletamenteVacio) {
    return (
      <div className="space-y-6">
        {/* Mensaje de bienvenida */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">¡Bienvenido a AgroMonitor!</CardTitle>
            <CardDescription className="text-base mt-2">
              Comienza configurando tu establecimiento y agregando tu primer animal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-2 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">1. Configurar Establecimiento</CardTitle>
                  </div>
                  <CardDescription>
                    Completa la información de tu establecimiento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full" variant="outline">
                    <Link href="/configuracion/establecimientos">
                      Configurar
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <List className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">2. Crear Lotes</CardTitle>
                  </div>
                  <CardDescription>
                    Organiza tu ganado en lotes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full" variant="outline" disabled={totalEstablecimientos === 0}>
                    <Link href={totalEstablecimientos > 0 ? "/configuracion/establecimientos" : "#"}>
                      {totalEstablecimientos > 0 ? "Crear Lotes" : "Primero configura un establecimiento"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">3. Agregar Animales</CardTitle>
                  </div>
                  <CardDescription>
                    Registra tu primer animal en el sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full" variant="outline" disabled={totalLotes === 0}>
                    <Link href={totalLotes > 0 ? "/ganado?crear=true" : "#"}>
                      {totalLotes > 0 ? "Agregar Animal" : "Primero crea lotes"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Guía rápida */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle>Guía Rápida</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium">Configura tu establecimiento</p>
                  <p className="text-muted-foreground">
                    Agrega la información básica: nombre, hectáreas, ubicación y RENSPA
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium">Crea tus lotes</p>
                  <p className="text-muted-foreground">
                    Organiza tu ganado en lotes según su propósito: reproductivo, recría, engorde, etc.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium">Registra tus animales</p>
                  <p className="text-muted-foreground">
                    Comienza agregando tus animales con su información básica: caravana, raza, categoría, etc.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Si tiene algunos datos pero no todos
  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle>Continúa Configurando</CardTitle>
        <CardDescription>
          Tienes algunos datos, pero puedes agregar más
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {totalLotes === 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <List className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Crear Lotes</CardTitle>
                </div>
                <CardDescription>
                  Organiza tu ganado en lotes para mejor gestión
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/configuracion/establecimientos">
                    Crear Lotes
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {totalAnimales === 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Agregar Animales</CardTitle>
                </div>
                <CardDescription>
                  Comienza registrando tus animales en el sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/ganado?crear=true">
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Primer Animal
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

