"use client"

import { memo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MilkIcon as Cow, MapPin, AlertTriangle, Eye, Edit } from "lucide-react"
import { 
  getBodyConditionColor, 
  getHealthStatusColor, 
  getCategoryColor 
} from "@/lib/utils/livestock-helpers"

// Tipo flexible que acepta tanto datos de BD como mock
interface AnimalData {
  id: string
  name?: string
  nombre?: string
  tagNumber?: string
  caravanaVisual?: string
  breed?: string
  raza?: { nombre: string } | string
  category?: string
  categoria?: { nombre: string } | string
  weight?: number
  pesoActual?: number
  bodyConditionScore?: number
  ccActual?: number
  dailyGain?: number
  location?: string
  ubicacion?: string
  healthStatus?: string
  marketValue?: number
  alerts?: string[]
}

interface AnimalCardProps {
  animal: AnimalData
  onSelect: (animal: AnimalData) => void
}

/**
 * Componente memoizado para mostrar la tarjeta de un animal
 * Compatible con datos de BD y datos mock
 */
export const AnimalCard = memo(({ animal, onSelect }: AnimalCardProps) => {
  // Normalizar datos para soportar ambos formatos
  const name = animal.name || animal.nombre || 'Sin nombre'
  const tagNumber = animal.tagNumber || animal.caravanaVisual || ''
  const breed = typeof animal.raza === 'object' ? animal.raza?.nombre : (animal.breed || animal.raza || '')
  const category = typeof animal.categoria === 'object' ? animal.categoria?.nombre : (animal.category || animal.categoria || '')
  const weight = animal.weight || animal.pesoActual || 0
  const bodyConditionScore = animal.bodyConditionScore || animal.ccActual || 0
  const dailyGain = animal.dailyGain || 0
  const location = animal.location || animal.ubicacion || ''
  const healthStatus = animal.healthStatus || 'Saludable'
  const marketValue = animal.marketValue || (weight * 3.5)
  const alerts = animal.alerts || []

  return (
    <Card
      className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer"
      onClick={() => onSelect(animal)}
    >
      <CardHeader className="pb-3 border-b-2 border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Cow className="h-5 w-5 text-blue-600" />
            {name}
          </CardTitle>
          <Badge className={getHealthStatusColor(healthStatus)} variant="outline">
            {healthStatus}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-2">
          <span>#{tagNumber}</span>
          <span>•</span>
          <span>{breed}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Categoría:</span>
            <Badge className={getCategoryColor(category)} variant="outline">
              {category}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Peso:</span>
              <p className="font-semibold">{weight} kg</p>
            </div>
            <div>
              <span className="text-gray-600">Ganancia diaria:</span>
              <p className="font-semibold text-green-600">+{dailyGain} kg</p>
            </div>
            <div>
              <span className="text-gray-600">Condición corporal:</span>
              <p className={`font-semibold ${getBodyConditionColor(bodyConditionScore)}`}>
                {bodyConditionScore}/9
              </p>
            </div>
            <div>
              <span className="text-gray-600">Ubicación:</span>
              <p className="font-semibold flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location || 'Sin asignar'}
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Valor estimado:</span>
            <span className="font-semibold text-green-600">${Math.round(marketValue)}</span>
          </div>

          {alerts.length > 0 && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>{alerts.length} alerta(s)</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 bg-transparent"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(animal)
              }}
            >
              <Eye className="h-4 w-4 mr-1" />
              Ver
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 bg-transparent"
              onClick={(e) => {
                e.stopPropagation()
                // Aquí iría la lógica de editar
              }}
            >
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

AnimalCard.displayName = "AnimalCard"

