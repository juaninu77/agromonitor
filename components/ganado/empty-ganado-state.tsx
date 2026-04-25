"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Plus, ArrowRight, BookOpen, MapPin, List } from "lucide-react"
import Link from "next/link"

interface EmptyGanadoStateProps {
  totalLotes: number
}

export function EmptyGanadoState({ totalLotes }: EmptyGanadoStateProps) {
  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Bot className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Aún no tienes animales registrados</CardTitle>
          <CardDescription className="text-base mt-2">
            Comienza agregando tu primer animal al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalLotes === 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-medium mb-2">
                  ⚠️ Primero necesitas crear lotes
                </p>
                <p className="text-sm text-amber-700">
                  Para registrar animales, primero debes crear lotes en tu establecimiento.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <List className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Crear Lotes</CardTitle>
                    </div>
                    <CardDescription>
                      Organiza tu ganado en lotes según su propósito
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full">
                      <Link href="/configuracion/establecimientos">
                        Ir a Configuración
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Guía Rápida</CardTitle>
                    </div>
                    <CardDescription>
                      Aprende cómo organizar tu ganado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full" disabled>
                      Próximamente
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  Tienes {totalLotes} {totalLotes === 1 ? 'lote' : 'lotes'} configurado{totalLotes === 1 ? '' : 's'}. 
                  Ya puedes comenzar a registrar animales.
                </p>
              </div>
              <div className="flex justify-center">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
                  <Link href="/ganado?crear=true">
                    <Plus className="mr-2 h-5 w-5" />
                    Registrar Primer Animal
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guía rápida */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle>¿Cómo registrar animales?</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                1
              </div>
              <div>
                <p className="font-medium">Información básica</p>
                <p className="text-muted-foreground">
                  Caravana, nombre, raza, categoría, sexo y fecha de nacimiento
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                2
              </div>
              <div>
                <p className="font-medium">Asignar a un lote</p>
                <p className="text-muted-foreground">
                  Selecciona el lote donde se encuentra el animal
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                3
              </div>
              <div>
                <p className="font-medium">Registrar peso inicial</p>
                <p className="text-muted-foreground">
                  Agrega el peso actual del animal para comenzar el seguimiento
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

