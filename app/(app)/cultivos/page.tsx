"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sprout,
  Droplets,
  Bug,
  Leaf,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Beaker,
  Zap,
  Target,
  BarChart3,
  Activity,
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
} from "lucide-react"

// Datos simulados desde perspectiva agronómica
const cropData = {
  activePlantings: [
    {
      id: "1",
      crop: "Maíz Híbrido DK-390",
      plot: "Lote Norte A-1",
      area: 25.5,
      plantingDate: "2024-03-15",
      expectedHarvest: "2024-07-20",
      currentStage: "Floración (R1)",
      stageProgress: 65,
      daysAfterPlanting: 95,
      thermalUnits: 1250,
      requiredThermalUnits: 1800,
      plantPopulation: 75000,
      estimatedYield: 12.5,
      healthStatus: "Bueno",
      riskLevel: "Bajo",
      lastInspection: "2024-06-15",
      issues: [],
      irrigationStatus: "Óptimo",
      soilMoisture: 65,
      weatherRisk: "Bajo",
    },
    {
      id: "2",
      crop: "Soja RR Intacta",
      plot: "Lote Sur B-3",
      area: 18.2,
      plantingDate: "2024-04-01",
      expectedHarvest: "2024-08-15",
      currentStage: "Llenado de Granos (R5)",
      stageProgress: 80,
      daysAfterPlanting: 75,
      thermalUnits: 980,
      requiredThermalUnits: 1200,
      plantPopulation: 320000,
      estimatedYield: 3.8,
      healthStatus: "Excelente",
      riskLevel: "Muy Bajo",
      lastInspection: "2024-06-18",
      issues: [],
      irrigationStatus: "Bueno",
      soilMoisture: 58,
      weatherRisk: "Bajo",
    },
    {
      id: "3",
      crop: "Trigo Baguette 31",
      plot: "Lote Este C-2",
      area: 32.0,
      plantingDate: "2024-05-10",
      expectedHarvest: "2024-09-25",
      currentStage: "Macollaje (Z25)",
      stageProgress: 35,
      daysAfterPlanting: 40,
      thermalUnits: 420,
      requiredThermalUnits: 1600,
      plantPopulation: 4500000,
      estimatedYield: 4.2,
      healthStatus: "Regular",
      riskLevel: "Medio",
      lastInspection: "2024-06-20",
      issues: ["Presión de malezas", "Deficiencia de Nitrógeno"],
      irrigationStatus: "Atención",
      soilMoisture: 42,
      weatherRisk: "Medio",
    },
    {
      id: "4",
      crop: "Girasol Alto Oleico",
      plot: "Lote Oeste D-1",
      area: 15.8,
      plantingDate: "2024-04-20",
      expectedHarvest: "2024-08-30",
      currentStage: "Botón Floral (R4)",
      stageProgress: 55,
      daysAfterPlanting: 60,
      thermalUnits: 720,
      requiredThermalUnits: 1400,
      plantPopulation: 55000,
      estimatedYield: 2.8,
      healthStatus: "Bueno",
      riskLevel: "Bajo",
      lastInspection: "2024-06-19",
      issues: [],
      irrigationStatus: "Óptimo",
      soilMoisture: 62,
      weatherRisk: "Bajo",
    },
  ],
  selectedCrop: {
    id: "1",
    crop: "Maíz Híbrido DK-390",
    plot: "Lote Norte A-1",
    area: 25.5,
    plantingDate: "2024-03-15",
    expectedHarvest: "2024-07-20",
    currentStage: "Floración (R1)",
    stageProgress: 65,
    daysAfterPlanting: 95,
    thermalUnits: 1250,
    requiredThermalUnits: 1800,
    plantPopulation: 75000,
    estimatedYield: 12.5,
    healthStatus: "Bueno",
    riskLevel: "Bajo",
    lastInspection: "2024-06-15",
    issues: [],
  },
  phenologyData: [
    {
      stage: "Emergencia",
      date: "2024-03-25",
      percentage: 100,
      observations: "Emergencia uniforme, 95% de plantas emergidas",
    },
    {
      stage: "V6 (6 hojas)",
      date: "2024-04-20",
      percentage: 100,
      observations: "Desarrollo vegetativo normal, aplicación de herbicida",
    },
    {
      stage: "V12 (12 hojas)",
      date: "2024-05-15",
      percentage: 100,
      observations: "Primera fertilización nitrogenada aplicada",
    },
    {
      stage: "VT (Panojamiento)",
      date: "2024-06-01",
      percentage: 100,
      observations: "Inicio de diferenciación floral",
    },
    {
      stage: "R1 (Floración)",
      date: "2024-06-15",
      percentage: 65,
      observations: "Floración en progreso, condiciones favorables",
    },
  ],
  nutritionPlan: [
    {
      nutrient: "Nitrógeno (N)",
      applied: 180,
      recommended: 220,
      unit: "kg/ha",
      status: "Pendiente",
      nextApplication: "2024-06-25",
      source: "Urea 46%",
    },
    {
      nutrient: "Fósforo (P2O5)",
      applied: 80,
      recommended: 80,
      unit: "kg/ha",
      status: "Completo",
      nextApplication: null,
      source: "Fosfato Diamónico",
    },
    {
      nutrient: "Potasio (K2O)",
      applied: 60,
      recommended: 100,
      unit: "kg/ha",
      status: "Pendiente",
      nextApplication: "2024-07-01",
      source: "Cloruro de Potasio",
    },
  ],
  pestManagement: [
    {
      type: "Plaga",
      name: "Cogollero del Maíz",
      scientificName: "Spodoptera frugiperda",
      currentLevel: 2,
      economicThreshold: 3,
      status: "Monitoreo",
      lastTreatment: null,
      recommendedAction: "Continuar monitoreo semanal",
    },
    {
      type: "Enfermedad",
      name: "Roya del Maíz",
      scientificName: "Puccinia sorghi",
      currentLevel: 1,
      economicThreshold: 4,
      status: "Bajo Control",
      lastTreatment: null,
      recommendedAction: "Monitoreo preventivo",
    },
    {
      type: "Maleza",
      name: "Yuyo Colorado",
      scientificName: "Amaranthus quitensis",
      currentLevel: 3,
      economicThreshold: 2,
      status: "Requiere Acción",
      lastTreatment: "2024-06-10",
      recommendedAction: "Aplicación de herbicida selectivo",
    },
  ],
  irrigationData: {
    currentSoilMoisture: 65,
    fieldCapacity: 100,
    wiltingPoint: 25,
    availableWater: 53,
    cropCoefficient: 1.2,
    dailyET: 6.5,
    weeklyRequirement: 45.5,
    lastIrrigation: "2024-06-18",
    nextIrrigation: "2024-06-22",
    irrigationEfficiency: 85,
    totalSeasonWater: 450,
  },
  soilAnalysis: {
    pH: 6.8,
    organicMatter: 3.2,
    nitrogen: 45,
    phosphorus: 28,
    potassium: 180,
    calcium: 2400,
    magnesium: 320,
    sulfur: 12,
    cec: 18.5,
    texture: "Franco Limoso",
    bulkDensity: 1.35,
    infiltrationRate: 2.5,
    recommendations: [
      "Mantener niveles de materia orgánica",
      "Aplicar azufre para mejorar disponibilidad de nutrientes",
      "Considerar encalado ligero para próxima temporada",
    ],
  },
}

export default function CultivosPage() {
  const [selectedTab, setSelectedTab] = useState("lista")
  const [selectedCrop, setSelectedCrop] = useState(cropData.activePlantings[0])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("todos")

  const getStageColor = (progress: number) => {
    if (progress >= 80) return "bg-green-500"
    if (progress >= 60) return "bg-blue-500"
    if (progress >= 40) return "bg-yellow-500"
    return "bg-gray-400"
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "Muy Bajo":
        return "bg-green-100 text-green-800 border-green-200"
      case "Bajo":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "Medio":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "Alto":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "Crítico":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case "Excelente":
        return "bg-green-100 text-green-800 border-green-200"
      case "Bueno":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "Regular":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "Malo":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const filteredCrops = cropData.activePlantings.filter((crop) => {
    const matchesSearch =
      crop.crop.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crop.plot.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter =
      filterStatus === "todos" ||
      (filterStatus === "floracion" && crop.currentStage.includes("Floración")) ||
      (filterStatus === "vegetativo" && crop.currentStage.includes("V")) ||
      (filterStatus === "maduracion" && crop.currentStage.includes("R")) ||
      (filterStatus === "atencion" && crop.issues.length > 0)
    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Cultivos</h1>
          <p className="text-gray-600 mt-1">Monitoreo agronómico integral y toma de decisiones</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-2 bg-transparent">
            <Calendar className="h-4 w-4 mr-2" />
            Planificar Siembra
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 border-2 border-green-600">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Cultivo
          </Button>
        </div>
      </div>

      {/* Resumen de Cultivos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-gray-200 hover:border-green-300 hover:shadow-lg transition-all">
          <CardHeader className="pb-2 border-b-2 border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-600">Cultivos Activos</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Sprout className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{cropData.activePlantings.length}</p>
                <p className="text-xs text-gray-600">Lotes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all">
          <CardHeader className="pb-2 border-b-2 border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-600">Área Total</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">
                  {cropData.activePlantings.reduce((sum, crop) => sum + crop.area, 0).toFixed(1)}
                </p>
                <p className="text-xs text-gray-600">Hectáreas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all">
          <CardHeader className="pb-2 border-b-2 border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-600">Rendimiento Promedio</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {(
                    cropData.activePlantings.reduce((sum, crop) => sum + crop.estimatedYield, 0) /
                    cropData.activePlantings.length
                  ).toFixed(1)}
                </p>
                <p className="text-xs text-gray-600">t/ha promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-gray-200 hover:border-orange-300 hover:shadow-lg transition-all">
          <CardHeader className="pb-2 border-b-2 border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-600">Alertas Activas</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  {cropData.activePlantings.reduce((sum, crop) => sum + crop.issues.length, 0)}
                </p>
                <p className="text-xs text-gray-600">Problemas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenido Principal */}
      <Card className="border-2 border-gray-200">
        <CardContent className="p-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 border-2 border-gray-200">
              <TabsTrigger value="lista" className="border-r-2 border-gray-200">
                Lista de Cultivos
              </TabsTrigger>
              <TabsTrigger value="detalle" className="border-r-2 border-gray-200">
                Detalle Individual
              </TabsTrigger>
              <TabsTrigger value="reportes">Reportes</TabsTrigger>
            </TabsList>

            <TabsContent value="lista" className="mt-6">
              {/* Filtros y Búsqueda */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar por cultivo o lote..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-2"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-48 border-2">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los cultivos</SelectItem>
                      <SelectItem value="vegetativo">Estado vegetativo</SelectItem>
                      <SelectItem value="floracion">En floración</SelectItem>
                      <SelectItem value="maduracion">En maduración</SelectItem>
                      <SelectItem value="atencion">Requieren atención</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Lista de Cultivos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCrops.map((crop) => (
                  <Card
                    key={crop.id}
                    className="border-2 border-gray-200 hover:border-green-300 hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedCrop(crop)
                      setSelectedTab("detalle")
                    }}
                  >
                    <CardHeader className="pb-3 border-b-2 border-gray-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Sprout className="h-5 w-5 text-green-600" />
                          {crop.crop}
                        </CardTitle>
                        <Badge className={getRiskColor(crop.riskLevel)} variant="outline">
                          {crop.riskLevel}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {crop.plot} • {crop.area} ha
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{crop.currentStage}</span>
                            <span>{crop.stageProgress}%</span>
                          </div>
                          <Progress value={crop.stageProgress} className={`h-2 ${getStageColor(crop.stageProgress)}`} />
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Días Siembra:</span>
                            <p className="font-semibold">{crop.daysAfterPlanting}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Rend. Est.:</span>
                            <p className="font-semibold">{crop.estimatedYield} t/ha</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Estado:</span>
                            <Badge className={getHealthStatusColor(crop.healthStatus)} variant="outline">
                              {crop.healthStatus}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-gray-600">Humedad:</span>
                            <p className="font-semibold flex items-center gap-1">
                              <Droplets className="h-3 w-3 text-blue-500" />
                              {crop.soilMoisture}%
                            </p>
                          </div>
                        </div>

                        {crop.issues.length > 0 && (
                          <div className="flex items-center gap-2 text-amber-600 text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            <span>{crop.issues.length} problema(s) detectado(s)</span>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="detalle" className="mt-6">
              {/* Detalle del Cultivo Seleccionado */}
              <Card className="border-2 border-gray-200">
                <CardHeader className="border-b-2 border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{selectedCrop.crop}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {selectedCrop.plot}
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="h-4 w-4" />
                          {selectedCrop.area} hectáreas
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Siembra: {new Date(selectedCrop.plantingDate).toLocaleDateString()}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <Badge className={getRiskColor(selectedCrop.riskLevel)} variant="outline">
                        Riesgo: {selectedCrop.riskLevel}
                      </Badge>
                      <p className="text-sm text-gray-600 mt-1">
                        Última inspección: {new Date(selectedCrop.lastInspection).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <Tabs defaultValue="fenologia" className="w-full">
                    <TabsList className="grid w-full grid-cols-6 border-2 border-gray-200">
                      <TabsTrigger value="fenologia" className="border-r-2 border-gray-200">
                        Fenología
                      </TabsTrigger>
                      <TabsTrigger value="nutricion" className="border-r-2 border-gray-200">
                        Nutrición
                      </TabsTrigger>
                      <TabsTrigger value="sanidad" className="border-r-2 border-gray-200">
                        Sanidad
                      </TabsTrigger>
                      <TabsTrigger value="riego" className="border-r-2 border-gray-200">
                        Riego
                      </TabsTrigger>
                      <TabsTrigger value="suelo" className="border-r-2 border-gray-200">
                        Suelo
                      </TabsTrigger>
                      <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
                    </TabsList>

                    <TabsContent value="fenologia" className="mt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <Sprout className="h-5 w-5 text-green-600" />
                              Estado Fenológico Actual
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="space-y-4">
                              <div className="text-center">
                                <h3 className="text-2xl font-bold text-green-600">{selectedCrop.currentStage}</h3>
                                <p className="text-gray-600">Progreso: {selectedCrop.stageProgress}%</p>
                                <Progress value={selectedCrop.stageProgress} className="mt-2 h-3" />
                              </div>

                              <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-gray-100">
                                <div>
                                  <span className="text-sm text-gray-600">Días desde siembra</span>
                                  <p className="text-lg font-semibold">{selectedCrop.daysAfterPlanting}</p>
                                </div>
                                <div>
                                  <span className="text-sm text-gray-600">Unidades térmicas</span>
                                  <p className="text-lg font-semibold">
                                    {selectedCrop.thermalUnits}/{selectedCrop.requiredThermalUnits}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-sm text-gray-600">Población plantas</span>
                                  <p className="text-lg font-semibold">
                                    {selectedCrop.plantPopulation.toLocaleString()}/ha
                                  </p>
                                </div>
                                <div>
                                  <span className="text-sm text-gray-600">Estado sanitario</span>
                                  <p className="text-lg font-semibold text-green-600">{selectedCrop.healthStatus}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <Clock className="h-5 w-5 text-blue-600" />
                              Historial Fenológico
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="space-y-3">
                              {cropData.phenologyData.map((stage, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-3 p-3 border-2 border-gray-100 rounded-lg"
                                >
                                  <div
                                    className={`w-3 h-3 rounded-full ${stage.percentage === 100 ? "bg-green-500" : "bg-blue-500"}`}
                                  />
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                      <span className="font-medium">{stage.stage}</span>
                                      <span className="text-sm text-gray-600">
                                        {new Date(stage.date).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{stage.observations}</p>
                                  </div>
                                  {stage.percentage === 100 ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <div className="text-sm font-medium text-blue-600">{stage.percentage}%</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="nutricion" className="mt-6">
                      <Card className="border-2 border-gray-200">
                        <CardHeader className="border-b-2 border-gray-100">
                          <CardTitle className="flex items-center gap-2">
                            <Leaf className="h-5 w-5 text-green-600" />
                            Plan de Fertilización
                          </CardTitle>
                          <CardDescription>
                            Programa nutricional basado en análisis de suelo y requerimientos del cultivo
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="grid gap-4">
                            {cropData.nutritionPlan.map((nutrient, index) => (
                              <div key={index} className="p-4 border-2 border-gray-100 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-lg">{nutrient.nutrient}</h4>
                                  <Badge
                                    variant={nutrient.status === "Completo" ? "default" : "secondary"}
                                    className={
                                      nutrient.status === "Completo"
                                        ? "bg-green-100 text-green-800 border-green-200"
                                        : "bg-yellow-100 text-yellow-800 border-yellow-200"
                                    }
                                  >
                                    {nutrient.status}
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-600">Aplicado:</span>
                                    <p className="font-semibold">
                                      {nutrient.applied} {nutrient.unit}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Recomendado:</span>
                                    <p className="font-semibold">
                                      {nutrient.recommended} {nutrient.unit}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Fuente:</span>
                                    <p className="font-semibold">{nutrient.source}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Próxima aplicación:</span>
                                    <p className="font-semibold">
                                      {nutrient.nextApplication
                                        ? new Date(nutrient.nextApplication).toLocaleDateString()
                                        : "N/A"}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Progreso de aplicación</span>
                                    <span>{Math.round((nutrient.applied / nutrient.recommended) * 100)}%</span>
                                  </div>
                                  <Progress value={(nutrient.applied / nutrient.recommended) * 100} className="h-2" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="sanidad" className="mt-6">
                      <Card className="border-2 border-gray-200">
                        <CardHeader className="border-b-2 border-gray-100">
                          <CardTitle className="flex items-center gap-2">
                            <Bug className="h-5 w-5 text-red-600" />
                            Manejo Fitosanitario
                          </CardTitle>
                          <CardDescription>
                            Monitoreo de plagas, enfermedades y malezas con umbrales económicos
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            {cropData.pestManagement.map((pest, index) => (
                              <div key={index} className="p-4 border-2 border-gray-100 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <h4 className="font-semibold">{pest.name}</h4>
                                    <p className="text-sm text-gray-600 italic">{pest.scientificName}</p>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                                      {pest.type}
                                    </Badge>
                                    <p className="text-sm text-gray-600">{pest.status}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                  <div>
                                    <span className="text-sm text-gray-600">Nivel actual:</span>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full ${
                                            pest.currentLevel >= pest.economicThreshold
                                              ? "bg-red-500"
                                              : pest.currentLevel >= pest.economicThreshold * 0.7
                                                ? "bg-yellow-500"
                                                : "bg-green-500"
                                          }`}
                                          style={{ width: `${(pest.currentLevel / 5) * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-semibold">{pest.currentLevel}/5</span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-600">Umbral económico:</span>
                                    <p className="font-semibold">{pest.economicThreshold}/5</p>
                                  </div>
                                  <div>
                                    <span className="text-sm text-gray-600">Último tratamiento:</span>
                                    <p className="font-semibold">
                                      {pest.lastTreatment
                                        ? new Date(pest.lastTreatment).toLocaleDateString()
                                        : "Ninguno"}
                                    </p>
                                  </div>
                                </div>

                                <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                                  <p className="text-sm">
                                    <strong>Recomendación:</strong> {pest.recommendedAction}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="riego" className="mt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <Droplets className="h-5 w-5 text-blue-600" />
                              Estado Hídrico del Suelo
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-sm mb-2">
                                  <span>Humedad del suelo</span>
                                  <span>{cropData.irrigationData.currentSoilMoisture}%</span>
                                </div>
                                <div className="relative">
                                  <Progress value={cropData.irrigationData.currentSoilMoisture} className="h-4" />
                                  <div className="absolute top-0 left-0 w-full h-4 flex items-center">
                                    <div
                                      className="w-0.5 h-4 bg-red-500"
                                      style={{ marginLeft: `${cropData.irrigationData.wiltingPoint}%` }}
                                    />
                                    <div
                                      className="w-0.5 h-4 bg-green-500 ml-auto"
                                      style={{ marginRight: `${100 - cropData.irrigationData.fieldCapacity}%` }}
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-600 mt-1">
                                  <span>Punto marchitez ({cropData.irrigationData.wiltingPoint}%)</span>
                                  <span>Capacidad campo ({cropData.irrigationData.fieldCapacity}%)</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-gray-100">
                                <div>
                                  <span className="text-sm text-gray-600">Agua disponible</span>
                                  <p className="text-lg font-semibold text-blue-600">
                                    {cropData.irrigationData.availableWater}%
                                  </p>
                                </div>
                                <div>
                                  <span className="text-sm text-gray-600">Coef. cultivo (Kc)</span>
                                  <p className="text-lg font-semibold">{cropData.irrigationData.cropCoefficient}</p>
                                </div>
                                <div>
                                  <span className="text-sm text-gray-600">ET diaria</span>
                                  <p className="text-lg font-semibold">{cropData.irrigationData.dailyET} mm</p>
                                </div>
                                <div>
                                  <span className="text-sm text-gray-600">Eficiencia riego</span>
                                  <p className="text-lg font-semibold text-green-600">
                                    {cropData.irrigationData.irrigationEfficiency}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <Calendar className="h-5 w-5 text-blue-600" />
                              Programación de Riego
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="space-y-4">
                              <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">Próximo riego recomendado</span>
                                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                    {new Date(cropData.irrigationData.nextIrrigation).toLocaleDateString()}
                                  </Badge>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-3">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Último riego:</span>
                                  <span className="font-semibold">
                                    {new Date(cropData.irrigationData.lastIrrigation).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Requerimiento semanal:</span>
                                  <span className="font-semibold">{cropData.irrigationData.weeklyRequirement} mm</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Agua aplicada temporada:</span>
                                  <span className="font-semibold">{cropData.irrigationData.totalSeasonWater} mm</span>
                                </div>
                              </div>

                              <Button className="w-full border-2 border-blue-600 bg-blue-600 hover:bg-blue-700">
                                <Droplets className="h-4 w-4 mr-2" />
                                Programar Riego
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="suelo" className="mt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <Beaker className="h-5 w-5 text-amber-600" />
                              Análisis Químico del Suelo
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 border-2 border-gray-100 rounded-lg text-center">
                                <span className="text-sm text-gray-600">pH</span>
                                <p className="text-2xl font-bold text-green-600">{cropData.soilAnalysis.pH}</p>
                                <span className="text-xs text-gray-500">Ligeramente ácido</span>
                              </div>
                              <div className="p-3 border-2 border-gray-100 rounded-lg text-center">
                                <span className="text-sm text-gray-600">M.O.</span>
                                <p className="text-2xl font-bold text-green-600">
                                  {cropData.soilAnalysis.organicMatter}%
                                </p>
                                <span className="text-xs text-gray-500">Bueno</span>
                              </div>
                              <div className="p-3 border-2 border-gray-100 rounded-lg text-center">
                                <span className="text-sm text-gray-600">N</span>
                                <p className="text-2xl font-bold text-yellow-600">{cropData.soilAnalysis.nitrogen}</p>
                                <span className="text-xs text-gray-500">ppm - Medio</span>
                              </div>
                              <div className="p-3 border-2 border-gray-100 rounded-lg text-center">
                                <span className="text-sm text-gray-600">P</span>
                                <p className="text-2xl font-bold text-green-600">{cropData.soilAnalysis.phosphorus}</p>
                                <span className="text-xs text-gray-500">ppm - Alto</span>
                              </div>
                              <div className="p-3 border-2 border-gray-100 rounded-lg text-center">
                                <span className="text-sm text-gray-600">K</span>
                                <p className="text-2xl font-bold text-green-600">{cropData.soilAnalysis.potassium}</p>
                                <span className="text-xs text-gray-500">ppm - Alto</span>
                              </div>
                              <div className="p-3 border-2 border-gray-100 rounded-lg text-center">
                                <span className="text-sm text-gray-600">CIC</span>
                                <p className="text-2xl font-bold text-blue-600">{cropData.soilAnalysis.cec}</p>
                                <span className="text-xs text-gray-500">meq/100g</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <Target className="h-5 w-5 text-purple-600" />
                              Propiedades Físicas
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="space-y-4">
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Textura:</span>
                                <span className="font-semibold">{cropData.soilAnalysis.texture}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Densidad aparente:</span>
                                <span className="font-semibold">{cropData.soilAnalysis.bulkDensity} g/cm³</span>
                              </div>
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Tasa de infiltración:</span>
                                <span className="font-semibold">{cropData.soilAnalysis.infiltrationRate} cm/h</span>
                              </div>
                            </div>

                            <div className="mt-6">
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-yellow-600" />
                                Recomendaciones
                              </h4>
                              <div className="space-y-2">
                                {cropData.soilAnalysis.recommendations.map((rec, index) => (
                                  <div
                                    key={index}
                                    className="p-2 bg-yellow-50 border-2 border-yellow-200 rounded text-sm"
                                  >
                                    • {rec}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="rendimiento" className="mt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <TrendingUp className="h-5 w-5 text-green-600" />
                              Proyección de Rendimiento
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="text-center mb-6">
                              <div className="text-4xl font-bold text-green-600 mb-2">
                                {selectedCrop.estimatedYield} t/ha
                              </div>
                              <p className="text-gray-600">Rendimiento estimado</p>
                            </div>

                            <div className="space-y-4">
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Rendimiento objetivo:</span>
                                <span className="font-semibold">13.0 t/ha</span>
                              </div>
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Rendimiento promedio zona:</span>
                                <span className="font-semibold">11.2 t/ha</span>
                              </div>
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Potencial genético:</span>
                                <span className="font-semibold">15.5 t/ha</span>
                              </div>
                            </div>

                            <div className="mt-6">
                              <div className="flex justify-between text-sm mb-2">
                                <span>Progreso hacia objetivo</span>
                                <span>{Math.round((selectedCrop.estimatedYield / 13.0) * 100)}%</span>
                              </div>
                              <Progress value={(selectedCrop.estimatedYield / 13.0) * 100} className="h-3" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <BarChart3 className="h-5 w-5 text-blue-600" />
                              Factores de Rendimiento
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Población de plantas</span>
                                  <span className="text-green-600">95%</span>
                                </div>
                                <Progress value={95} className="h-2" />
                              </div>

                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Estado nutricional</span>
                                  <span className="text-yellow-600">78%</span>
                                </div>
                                <Progress value={78} className="h-2" />
                              </div>

                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Manejo hídrico</span>
                                  <span className="text-green-600">88%</span>
                                </div>
                                <Progress value={88} className="h-2" />
                              </div>

                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Control fitosanitario</span>
                                  <span className="text-green-600">92%</span>
                                </div>
                                <Progress value={92} className="h-2" />
                              </div>

                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Condiciones climáticas</span>
                                  <span className="text-blue-600">85%</span>
                                </div>
                                <Progress value={85} className="h-2" />
                              </div>
                            </div>

                            <div className="mt-6 p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                              <p className="text-sm text-green-800">
                                <strong>Recomendación:</strong> Optimizar programa nutricional para alcanzar el
                                potencial de rendimiento objetivo.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reportes" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="border-2 border-gray-200 hover:border-green-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <Sprout className="h-5 w-5 text-green-600" />
                      Reporte Fenológico
                    </CardTitle>
                    <CardDescription>Seguimiento de etapas de desarrollo</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye progreso fenológico, unidades térmicas y proyecciones de cosecha.
                    </p>
                    <Button className="w-full">Generar Reporte</Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <Leaf className="h-5 w-5 text-blue-600" />
                      Reporte Nutricional
                    </CardTitle>
                    <CardDescription>Análisis de fertilización y nutrición</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye planes de fertilización, aplicaciones realizadas y recomendaciones.
                    </p>
                    <Button className="w-full">Generar Reporte</Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:border-red-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <Bug className="h-5 w-5 text-red-600" />
                      Reporte Fitosanitario
                    </CardTitle>
                    <CardDescription>Control de plagas y enfermedades</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye monitoreo de plagas, tratamientos aplicados y umbrales económicos.
                    </p>
                    <Button className="w-full">Generar Reporte</Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:border-cyan-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <Droplets className="h-5 w-5 text-cyan-600" />
                      Reporte de Riego
                    </CardTitle>
                    <CardDescription>Manejo hídrico y eficiencia</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye balance hídrico, programación de riegos y eficiencia del sistema.
                    </p>
                    <Button className="w-full">Generar Reporte</Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:border-amber-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <Beaker className="h-5 w-5 text-amber-600" />
                      Reporte de Suelos
                    </CardTitle>
                    <CardDescription>Análisis químico y físico del suelo</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye análisis de laboratorio, propiedades físicas y recomendaciones.
                    </p>
                    <Button className="w-full">Generar Reporte</Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                      Reporte de Rendimiento
                    </CardTitle>
                    <CardDescription>Proyecciones y análisis de productividad</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye estimaciones de rendimiento, factores limitantes y potencial productivo.
                    </p>
                    <Button className="w-full">Generar Reporte</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
