"use client"

import { memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MilkIcon as Cow, Heart, Weight, TrendingUp, Baby } from "lucide-react"
import { LoadingCards } from "./loading-state"

interface HerdOverviewData {
  totalAnimals: number
  breedingCows: number
  averageWeight: number
  averageDailyGain: number
  calvingRate: number
}

interface HerdOverviewProps {
  data: HerdOverviewData
  isLoading: boolean
}

export const HerdOverview = memo(function HerdOverview({ data, isLoading }: HerdOverviewProps) {
  if (isLoading) {
    return <LoadingCards message="Cargando estadísticas del rodeo..." />
  }

  const cards = [
    { title: "Total Animales", value: data.totalAnimals, unit: "Cabezas", icon: Cow, color: "text-blue-600" },
    { title: "Vacas Madres", value: data.breedingCows, unit: "Reproductoras", icon: Heart, color: "text-green-600" },
    { title: "Peso Promedio", value: data.averageWeight, unit: "kg", icon: Weight, color: "text-purple-600" },
    { title: "Ganancia Diaria", value: data.averageDailyGain, unit: "kg/día", icon: TrendingUp, color: "text-orange-600" },
    { title: "Tasa de Parición", value: `${data.calvingRate}%`, unit: "Parición", icon: Baby, color: "text-red-600" },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all">
          <CardHeader className="pb-2 border-b-2 border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-600">{card.title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <card.icon className={`h-8 w-8 ${card.color}`} />
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-gray-600">{card.unit}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
})
