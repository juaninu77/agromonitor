"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Beef, Tag, Hash, Calendar, Scale, AlertTriangle, UserPlus } from "lucide-react"

interface AnimalQuickCardProps {
  animal: any | null
  eid: string
  isNew: boolean
  onRegister?: () => void
}

function calcularEdad(fechaNacimiento: string | null): string {
  if (!fechaNacimiento) return "Desconocida"
  const nacimiento = new Date(fechaNacimiento)
  const hoy = new Date()
  const diffMs = hoy.getTime() - nacimiento.getTime()
  const meses = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44))
  if (meses < 12) return `${meses} meses`
  const años = Math.floor(meses / 12)
  const resto = meses % 12
  return resto > 0 ? `${años}a ${resto}m` : `${años} años`
}

export function AnimalQuickCard({ animal, eid, isNew, onRegister }: AnimalQuickCardProps) {
  if (isNew) {
    return (
      <Card className="border-2 border-yellow-300 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-yellow-200 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg">{eid}</span>
                  <Badge className="bg-yellow-200 text-yellow-800 border-yellow-300">
                    No registrado
                  </Badge>
                </div>
                <p className="text-sm text-yellow-700">
                  Este EID no se encontró en la base de datos
                </p>
              </div>
            </div>
            {onRegister && (
              <Button
                onClick={onRegister}
                variant="outline"
                className="border-yellow-400 text-yellow-800 hover:bg-yellow-100 h-12 px-4"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Registrar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!animal) return null

  const ultimoPeso = animal.ultimoPeso || animal.pesoActual || null
  const edad = calcularEdad(animal.fechaNacimiento)

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Beef className="h-7 w-7 text-blue-700" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-lg">
                {animal.caravanaVisual || animal.nombre || "Sin ID"}
              </span>
              {animal.categoria?.nombre && (
                <Badge variant="secondary">{animal.categoria.nombre}</Badge>
              )}
              {animal.sexo && (
                <Badge variant="outline">
                  {animal.sexo === "M" ? "Macho" : "Hembra"}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                <span className="font-mono">{animal.caravanaRfid || eid}</span>
              </div>
              {animal.raza?.nombre && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  <span>{animal.raza.nombre}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{edad}</span>
              </div>
              {ultimoPeso && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Scale className="h-3.5 w-3.5" />
                  <span>{ultimoPeso} kg</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
