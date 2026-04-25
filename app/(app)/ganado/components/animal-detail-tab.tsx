"use client"

import { memo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  MilkIcon as Cow,
  Heart,
  Activity,
  Weight,
  TrendingUp,
  CheckCircle,
  Stethoscope,
  Baby,
  Wheat,
  BarChart3,
  Target,
  Shield,
  Plus,
  Bot,
} from "lucide-react"
import { getBodyConditionColor, getHealthStatusColor } from "@/lib/utils/livestock-helpers"

interface AnimalDetailTabProps {
  selectedAnimal: any | null
  totalAnimals: number
  onOpenCreate: () => void
}

export const AnimalDetailTab = memo(function AnimalDetailTab({
  selectedAnimal,
  totalAnimals,
  onOpenCreate,
}: AnimalDetailTabProps) {
  if (!selectedAnimal) {
    return (
      <Card className="border-2 border-gray-200">
        <CardContent className="p-12 text-center">
          <Bot className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay animal seleccionado</h3>
          <p className="text-gray-500 mb-4">Selecciona un animal de la lista para ver sus detalles</p>
          {totalAnimals === 0 && (
            <Button onClick={onOpenCreate} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Registrar Primer Animal
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-gray-200">
      <CardHeader className="border-b-2 border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Cow className="h-6 w-6 text-blue-600" />
              {selectedAnimal.name} - #{selectedAnimal.tagNumber}
            </CardTitle>
            <CardDescription className="flex items-center gap-4 mt-2">
              <span>{selectedAnimal.breed}</span>
              <span>•</span>
              <span>{selectedAnimal.age}</span>
              <span>•</span>
              <span>{selectedAnimal.category}</span>
              <span>•</span>
              <span>{selectedAnimal.weight} kg</span>
            </CardDescription>
          </div>
          <div className="text-right">
            <Badge className={getHealthStatusColor(selectedAnimal.healthStatus)} variant="outline">
              {selectedAnimal.healthStatus}
            </Badge>
            <p className="text-sm text-gray-600 mt-1">
              Condición corporal:{" "}
              <span className={`font-semibold ${getBodyConditionColor(selectedAnimal.bodyConditionScore)}`}>
                {selectedAnimal.bodyConditionScore}/9
              </span>
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <Tabs defaultValue="peso" className="w-full">
          <TabsList className="grid w-full grid-cols-4 border-2 border-gray-200">
            <TabsTrigger value="peso" className="border-r-2 border-gray-200">Peso</TabsTrigger>
            <TabsTrigger value="reproduccion" className="border-r-2 border-gray-200">Reproducción</TabsTrigger>
            <TabsTrigger value="salud" className="border-r-2 border-gray-200">Salud</TabsTrigger>
            <TabsTrigger value="genetica">Genética</TabsTrigger>
          </TabsList>

          {/* Peso & Crecimiento */}
          <TabsContent value="peso" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-gray-200">
                <CardHeader className="border-b-2 border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <Weight className="h-5 w-5 text-blue-600" />
                    Peso y Desarrollo Actual
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 border-2 border-gray-100 rounded-lg">
                      <p className="text-3xl font-bold text-blue-600">{selectedAnimal.weight || "—"}</p>
                      <p className="text-sm text-gray-600">kg Peso Vivo</p>
                    </div>
                    <div className="text-center p-4 border-2 border-gray-100 rounded-lg">
                      <p className="text-3xl font-bold text-green-600">
                        {selectedAnimal.dailyGain ? `+${selectedAnimal.dailyGain}` : "—"}
                      </p>
                      <p className="text-sm text-gray-600">kg/día GDP</p>
                    </div>
                    <div className="text-center p-4 border-2 border-gray-100 rounded-lg">
                      <p className="text-3xl font-bold text-purple-600">
                        {selectedAnimal.bodyConditionScore || "—"}
                      </p>
                      <p className="text-sm text-gray-600">CC (1-9)</p>
                    </div>
                    <div className="text-center p-4 border-2 border-gray-100 rounded-lg">
                      <p className="text-3xl font-bold text-orange-600">
                        {selectedAnimal.feedEfficiency || "—"}
                      </p>
                      <p className="text-sm text-gray-600">Conversión</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200">
                <CardHeader className="border-b-2 border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Registros de Peso
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {selectedAnimal?.weightRecords?.length > 0 ? (
                      selectedAnimal.weightRecords.map((record: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 border-2 border-gray-100 rounded-lg">
                          <div>
                            <p className="font-semibold">{new Date(record.date).toLocaleDateString()}</p>
                            <p className="text-sm text-gray-600">GDP: +{record.gain} kg/día | CC: {record.bodyCondition}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-blue-600">{record.weight} kg</p>
                            <p className="text-xs text-gray-600">Peso vivo</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No hay registros de peso disponibles</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Reproducción */}
          <TabsContent value="reproduccion" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-gray-200">
                <CardHeader className="border-b-2 border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-600" />
                    Estado Reproductivo
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center mb-6">
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-lg px-4 py-2">
                      {selectedAnimal.reproductiveStatus || "Sin datos"}
                    </Badge>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                      <span className="text-gray-600">Descendencia total:</span>
                      <span className="font-semibold">{selectedAnimal.offspring || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                      <span className="text-gray-600">Progenie esperada:</span>
                      <span className="font-semibold">{selectedAnimal.expectedProgeny || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200">
                <CardHeader className="border-b-2 border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <Baby className="h-5 w-5 text-pink-600" />
                    Historial Reproductivo
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {selectedAnimal?.reproductiveHistory?.length > 0 ? (
                      selectedAnimal.reproductiveHistory.map((event: any, index: number) => (
                        <div key={index} className="p-3 border-2 border-gray-100 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{event.event}</span>
                            <span className="text-sm text-gray-600">{new Date(event.date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{event.details}</p>
                          <Badge
                            variant="outline"
                            className={
                              event.outcome === "Exitoso" || event.outcome === "Apto para reproducción" || event.outcome === "100% viabilidad"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-gray-100 text-gray-800 border-gray-200"
                            }
                          >
                            {event.outcome}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No hay registros reproductivos disponibles</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Salud */}
          <TabsContent value="salud" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-gray-200">
                <CardHeader className="border-b-2 border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-red-600" />
                    Estado de Salud
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center p-4 border-2 border-gray-100 rounded-lg">
                      <Weight className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{selectedAnimal.weight || "—"}</p>
                      <p className="text-sm text-gray-600">kg</p>
                    </div>
                    <div className="text-center p-4 border-2 border-gray-100 rounded-lg">
                      <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className={`text-2xl font-bold ${getBodyConditionColor(selectedAnimal.bodyConditionScore)}`}>
                        {selectedAnimal.bodyConditionScore || "—"}
                      </p>
                      <p className="text-sm text-gray-600">CC (1-9)</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                      <span className="text-gray-600">Última vacunación:</span>
                      <span className="font-semibold">
                        {selectedAnimal.lastVaccination
                          ? new Date(selectedAnimal.lastVaccination).toLocaleDateString()
                          : "Sin datos"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                      <span className="text-gray-600">Próxima vacunación:</span>
                      <span className="font-semibold">
                        {selectedAnimal.nextVaccination
                          ? new Date(selectedAnimal.nextVaccination).toLocaleDateString()
                          : "Sin programar"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200">
                <CardHeader className="border-b-2 border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    Historial Sanitario
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {selectedAnimal?.healthRecords?.length > 0 ? (
                      selectedAnimal.healthRecords.map((record: any, index: number) => (
                        <div key={index} className="p-3 border-2 border-gray-100 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                              {record.type}
                            </Badge>
                            <span className="text-sm text-gray-600">{new Date(record.date).toLocaleDateString()}</span>
                          </div>
                          <h4 className="font-semibold mb-1">{record.treatment}</h4>
                          <p className="text-sm text-gray-600 mb-2">{record.notes}</p>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Veterinario: {record.veterinarian}</span>
                            <span className="font-semibold">${record.cost?.toFixed(2)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No hay registros sanitarios disponibles</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Genética */}
          <TabsContent value="genetica" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-gray-200">
                <CardHeader className="border-b-2 border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-600" />
                    Valores Genéticos (DEPs)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-center mb-6">
                    <p className="text-3xl font-bold text-purple-600">{selectedAnimal.geneticValue || "—"}</p>
                    <p className="text-gray-600">Índice Genético Total</p>
                  </div>
                  <div className="space-y-3">
                    {selectedAnimal?.geneticData?.breedingValues ? (
                      Object.entries(selectedAnimal.geneticData.breedingValues).map(([trait, value], index) => {
                        const valueStr = String(value)
                        return (
                          <div key={index} className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                            <span className="text-gray-600">
                              {trait.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}:
                            </span>
                            <span
                              className={`font-semibold ${valueStr.startsWith("+") ? "text-green-600" : valueStr.startsWith("-") ? "text-red-600" : "text-blue-600"}`}
                            >
                              {valueStr}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No hay información genética disponible</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-200">
                <CardHeader className="border-b-2 border-gray-100">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    Pedigrí
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <div className="text-center p-4 border-2 border-blue-100 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-800">Animal</h4>
                      <p className="text-lg font-bold">{selectedAnimal.name}</p>
                      <p className="text-sm text-gray-600">#{selectedAnimal.tagNumber}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                        <h4 className="font-semibold text-gray-700">Padre</h4>
                        <p className="font-medium">{selectedAnimal?.geneticData?.pedigree?.sire || "No disponible"}</p>
                      </div>
                      <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                        <h4 className="font-semibold text-gray-700">Madre</h4>
                        <p className="font-medium">{selectedAnimal?.geneticData?.pedigree?.dam || "No disponible"}</p>
                      </div>
                    </div>
                    <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                      <h4 className="font-semibold text-gray-700">Abuelo Materno</h4>
                      <p className="font-medium">{selectedAnimal?.geneticData?.pedigree?.maternalGrandSire || "No disponible"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
})
