"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  MilkIcon as Cow,
  Heart,
  Activity,
  Weight,
  Calendar,
  TrendingUp,
  CheckCircle,
  Stethoscope,
  Baby,
  Wheat,
  BarChart3,
  Target,
  Shield,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Database,
  List,
  Grid3x3,
} from "lucide-react"
import { livestockData } from "@/lib/data/livestock-data"
import { useGanado, type AnimalAPI } from "@/lib/hooks/use-ganado"
import { 
  getBodyConditionColor, 
  getHealthStatusColor, 
  getCategoryColor 
} from "@/lib/utils/livestock-helpers"
import { AnimalCard } from "./components/animal-card"

// Tipos para el estado local (lo que no está en los datos)
type TabValue = "lista" | "detalle" | "reportes"

// Datos mock para fallback cuando no hay datos en BD
const mockData = {
  herdOverview: {
    totalAnimals: 485,
    breedingCows: 180,
    bulls: 12,
    steers: 145,
    heifers: 98,
    calves: 50,
    averageWeight: 520,
    averageDailyGain: 1.2,
    calvingRate: 92.5,
    mortalityRate: 1.8,
    averageBodyCondition: 6.5, // Escala 1-9 para carne
  },
  animalsList: [
    {
      id: "BEEF-001",
      name: "Toro Campeón",
      tagNumber: "T-2456",
      breed: "Angus Negro",
      birthDate: "2020-03-15",
      age: "4 años 3 meses",
      weight: 850,
      bodyConditionScore: 7.5,
      category: "Toro Reproductor",
      dailyGain: 0.8,
      reproductiveStatus: "Activo",
      offspring: 45,
      expectedProgeny: 25,
      healthStatus: "Saludable",
      lastVaccination: "2024-05-15",
      nextVaccination: "2024-08-15",
      geneticValue: 2150,
      location: "Potrero Reproductores",
      alerts: [],
      marketValue: 3500,
      feedEfficiency: 6.2,
    },
    {
      id: "BEEF-002",
      name: "Novillo Premium",
      tagNumber: "N-2457",
      breed: "Hereford",
      birthDate: "2022-01-20",
      age: "2 años 5 meses",
      weight: 520,
      bodyConditionScore: 6.8,
      category: "Novillo",
      dailyGain: 1.4,
      reproductiveStatus: "N/A",
      offspring: 0,
      expectedProgeny: 0,
      healthStatus: "Saludable",
      lastVaccination: "2024-04-20",
      nextVaccination: "2024-07-20",
      geneticValue: 1850,
      location: "Potrero Engorde A",
      alerts: [],
      marketValue: 1850,
      feedEfficiency: 7.1,
    },
    {
      id: "BEEF-003",
      name: "Vaquillona Elite",
      tagNumber: "V-2458",
      breed: "Brangus",
      birthDate: "2022-06-10",
      age: "2 años",
      weight: 420,
      bodyConditionScore: 6.2,
      category: "Vaquillona",
      dailyGain: 1.1,
      reproductiveStatus: "Preñada",
      offspring: 0,
      expectedProgeny: 1,
      healthStatus: "Saludable",
      lastVaccination: "2024-03-15",
      nextVaccination: "2024-06-15",
      geneticValue: 1920,
      location: "Potrero Vaquillonas",
      alerts: [],
      marketValue: 1680,
      feedEfficiency: 6.8,
    },
    {
      id: "BEEF-004",
      name: "Ternero Promesa",
      tagNumber: "T-2459",
      breed: "Angus Colorado",
      birthDate: "2023-11-05",
      age: "8 meses",
      weight: 280,
      bodyConditionScore: 6.5,
      category: "Ternero",
      dailyGain: 1.6,
      reproductiveStatus: "N/A",
      offspring: 0,
      expectedProgeny: 0,
      healthStatus: "Atención",
      lastVaccination: "2024-05-01",
      nextVaccination: "2024-08-01",
      geneticValue: 1780,
      location: "Potrero Terneros",
      alerts: ["Peso bajo para la edad"],
      marketValue: 980,
      feedEfficiency: 5.9,
    },
  ],
  selectedAnimal: {
    id: "BEEF-001",
    name: "Toro Campeón",
    tagNumber: "T-2456",
    breed: "Angus Negro",
    birthDate: "2020-03-15",
    age: "4 años 3 meses",
    weight: 850,
    bodyConditionScore: 7.5,
    category: "Toro Reproductor",
    dailyGain: 0.8,
    reproductiveStatus: "Activo",
    offspring: 45,
    expectedProgeny: 25,
    healthStatus: "Saludable",
    lastVaccination: "2024-05-15",
    nextVaccination: "2024-08-15",
    geneticValue: 2150,
    location: "Potrero Reproductores",
    marketValue: 3500,
    feedEfficiency: 6.2,
  },
  weightRecords: [
    { date: "2024-06-20", weight: 850, gain: 0.8, bodyCondition: 7.5 },
    { date: "2024-05-20", weight: 826, gain: 0.9, bodyCondition: 7.2 },
    { date: "2024-04-20", weight: 799, gain: 1.1, bodyCondition: 7.0 },
    { date: "2024-03-20", weight: 765, gain: 1.0, bodyCondition: 6.8 },
    { date: "2024-02-20", weight: 735, gain: 0.7, bodyCondition: 6.5 },
    { date: "2024-01-20", weight: 714, gain: 0.8, bodyCondition: 6.3 },
    { date: "2023-12-20", weight: 690, gain: 0.9, bodyCondition: 6.0 },
  ],
  reproductiveHistory: [
    {
      event: "Servicio",
      date: "2024-01-15",
      details: "Servicio natural con 8 vacas, temporada reproductiva 2024",
      outcome: "Exitoso",
    },
    {
      event: "Evaluación reproductiva",
      date: "2024-04-10",
      details: "Examen andrológico completo, calidad seminal excelente",
      outcome: "Apto para reproducción",
    },
    {
      event: "Descendencia",
      date: "2024-05-15",
      details: "Nacimiento de 6 terneros de su servicio anterior",
      outcome: "100% viabilidad",
    },
  ],
  healthRecords: [
    {
      date: "2024-06-01",
      type: "Vacunación",
      treatment: "Vacuna Clostridiosis + Carbunco",
      veterinarian: "Dr. Martínez",
      notes: "Aplicación preventiva anual",
      cost: 35.0,
    },
    {
      date: "2024-05-20",
      type: "Desparasitación",
      treatment: "Ivermectina + Levamisol",
      veterinarian: "Dr. López",
      notes: "Tratamiento preventivo contra parásitos internos y externos",
      cost: 25.0,
    },
    {
      date: "2024-04-15",
      type: "Chequeo",
      treatment: "Examen andrológico completo",
      veterinarian: "Dr. García",
      notes: "Evaluación de capacidad reproductiva, resultado excelente",
      cost: 80.0,
    },
  ],
  nutritionPlan: {
    dailyDryMatter: 18.5,
    crudeProtein: 14.2,
    metabolizableEnergy: 2.45,
    neutralDetergentFiber: 45.8,
    calcium: 0.65,
    phosphorus: 0.38,
    feedEfficiency: 6.2,
    feedCost: 12.5,
    ration: [
      { ingredient: "Pastura natural", amount: 12.5, percentage: 67.6 },
      { ingredient: "Suplemento proteico", amount: 2.8, percentage: 15.1 },
      { ingredient: "Grano de maíz", amount: 2.2, percentage: 11.9 },
      { ingredient: "Heno de alfalfa", amount: 0.8, percentage: 4.3 },
      { ingredient: "Sales minerales", amount: 0.2, percentage: 1.1 },
    ],
  },
  geneticData: {
    pedigree: {
      sire: "Angus Elite Champion 2018",
      dam: "Vaca Madre Superior",
      maternalGrandSire: "Toro Abuelo Materno",
    },
    breedingValues: {
      birthWeight: "+2.8 kg",
      weaningWeight: "+35 kg",
      yearlingWeight: "+58 kg",
      matureWeight: "+85 kg",
      marbling: "+0.45",
      ribeye: "+1.2 cm²",
      backfat: "-1.8 mm",
      maternalMilk: "+18 kg",
    },
    genomicReliability: 88,
  },
}

export default function GanadoPage() {
  const [selectedTab, setSelectedTab] = useState<TabValue>("lista")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("todos")
  const [useMockData, setUseMockData] = useState(false)
  const [viewMode, setViewMode] = useState<"lista" | "tarjetas">("lista")
  
  // Hook para cargar datos de la BD
  const { animales, stats, isLoading, error, refetch } = useGanado()
  
  // Determinar qué datos usar (BD o mock)
  const dataSource = useMemo(() => {
    if (useMockData || (animales.length === 0 && !isLoading)) {
      return {
        animals: livestockData.animalsList,
        herdOverview: livestockData.herdOverview,
        isMock: true,
      }
    }
    return {
      animals: animales.map(a => ({
        ...a,
        name: a.nombre || a.name || a.caravanaVisual || 'Sin nombre',
        tagNumber: a.caravanaVisual || a.tagNumber || '',
        breed: a.raza?.nombre || a.breed || '',
        category: a.categoria?.nombre || a.category || '',
        birthDate: a.fechaNacimiento || a.birthDate || '',
        age: a.edad || a.age || '',
        reproductiveStatus: a.reproductiveStatus || 'N/A',
        offspring: a.offspring || 0,
        expectedProgeny: a.expectedProgeny || 0,
        geneticValue: a.geneticValue || 0,
        feedEfficiency: a.feedEfficiency || 0,
        lastVaccination: a.lastVaccination || '',
        nextVaccination: a.nextVaccination || '',
      })),
      herdOverview: {
        totalAnimals: stats?.total || 0,
        breedingCows: stats?.porCategoria?.['vaca'] || 0,
        bulls: stats?.porCategoria?.['toro'] || 0,
        steers: stats?.porCategoria?.['novillo'] || 0,
        heifers: stats?.porCategoria?.['vaquillona'] || 0,
        calves: (stats?.porCategoria?.['ternero'] || 0) + (stats?.porCategoria?.['ternera'] || 0),
        averageWeight: stats?.pesoPromedio || 0,
        averageDailyGain: 0,
        calvingRate: 0,
        mortalityRate: 0,
        averageBodyCondition: 0,
      },
      isMock: false,
    }
  }, [animales, stats, isLoading, useMockData])

  const [selectedAnimal, setSelectedAnimal] = useState<any>(
    dataSource.animals[0] || livestockData.animalsList[0]
  )

  // ✅ Memoizar el filtro de animales - solo se recalcula cuando cambian searchTerm o filterStatus
  const filteredAnimals = useMemo(() => {
    return dataSource.animals.filter((animal: any) => {
      const matchesSearch =
        (animal.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (animal.tagNumber || '').includes(searchTerm)
      
      const matchesFilter =
        filterStatus === "todos" ||
        (filterStatus === "reproductores" &&
          (animal.category?.toLowerCase().includes("toro") || 
           animal.category?.toLowerCase().includes("vaca"))) ||
        (filterStatus === "engorde" && animal.category?.toLowerCase().includes("novillo")) ||
        (filterStatus === "reposicion" && animal.category?.toLowerCase().includes("vaquillona")) ||
        (filterStatus === "atencion" && animal.healthStatus === "Atención")
      
      return matchesSearch && matchesFilter
    })
  }, [dataSource.animals, searchTerm, filterStatus])

  // ✅ Memoizar el callback de selección de animal
  const handleAnimalSelect = useCallback((animal: any) => {
    setSelectedAnimal(animal)
    setSelectedTab("detalle")
  }, [])

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Ganado Bovino</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-600">Producción de carne y manejo reproductivo integral</p>
            <Badge 
              variant="outline" 
              className={dataSource.isMock 
                ? "bg-amber-100 text-amber-800 border-amber-200" 
                : "bg-green-100 text-green-800 border-green-200"
              }
            >
              <Database className="h-3 w-3 mr-1" />
              {dataSource.isMock ? 'Datos de ejemplo' : 'Base de datos'}
            </Badge>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="border-2 bg-transparent"
            onClick={() => setUseMockData(!useMockData)}
          >
            {useMockData ? 'Ver BD' : 'Ver Demo'}
          </Button>
          <Button 
            variant="outline" 
            className="border-2 bg-transparent"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline" className="border-2 bg-transparent">
            <Calendar className="h-4 w-4 mr-2" />
            Programa Reproductivo
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 border-2 border-blue-600">
            <Plus className="h-4 w-4 mr-2" />
            Registrar Animal
          </Button>
        </div>
      </div>

      {/* Resumen del Rodeo */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} className="border-2 border-gray-200">
              <CardHeader className="pb-2 border-b-2 border-gray-100">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div>
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-12 mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all">
            <CardHeader className="pb-2 border-b-2 border-gray-100">
              <CardTitle className="text-sm font-medium text-gray-600">Total Animales</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Cow className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{dataSource.herdOverview.totalAnimals}</p>
                  <p className="text-xs text-gray-600">Cabezas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200 hover:border-green-300 hover:shadow-lg transition-all">
            <CardHeader className="pb-2 border-b-2 border-gray-100">
              <CardTitle className="text-sm font-medium text-gray-600">Vacas Madres</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Heart className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{dataSource.herdOverview.breedingCows}</p>
                  <p className="text-xs text-gray-600">Reproductoras</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all">
            <CardHeader className="pb-2 border-b-2 border-gray-100">
              <CardTitle className="text-sm font-medium text-gray-600">Peso Promedio</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Weight className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{dataSource.herdOverview.averageWeight}</p>
                  <p className="text-xs text-gray-600">kg</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200 hover:border-orange-300 hover:shadow-lg transition-all">
            <CardHeader className="pb-2 border-b-2 border-gray-100">
              <CardTitle className="text-sm font-medium text-gray-600">Ganancia Diaria</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{dataSource.herdOverview.averageDailyGain}</p>
                  <p className="text-xs text-gray-600">kg/día</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-gray-200 hover:border-red-300 hover:shadow-lg transition-all">
            <CardHeader className="pb-2 border-b-2 border-gray-100">
              <CardTitle className="text-sm font-medium text-gray-600">Tasa de Parición</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Baby className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold">{dataSource.herdOverview.calvingRate}%</p>
                  <p className="text-xs text-gray-600">Parición</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contenido Principal */}
      <Card className="border-2 border-gray-200">
        <CardContent className="p-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 border-2 border-gray-200">
              <TabsTrigger value="lista" className="border-r-2 border-gray-200">
                Lista de Animales
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
                      placeholder="Buscar por nombre o número de caravana..."
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
                      <SelectValue placeholder="Filtrar por categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los animales</SelectItem>
                      <SelectItem value="reproductores">Reproductores</SelectItem>
                      <SelectItem value="engorde">Novillos engorde</SelectItem>
                      <SelectItem value="reposicion">Vaquillonas reposición</SelectItem>
                      <SelectItem value="atencion">Requieren atención</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Toggle de Vista */}
                  <div className="flex border-2 rounded-md overflow-hidden">
                    <Button
                      variant={viewMode === "lista" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("lista")}
                      className="rounded-none border-0"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "tarjetas" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("tarjetas")}
                      className="rounded-none border-0 border-l-2"
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Vista de Lista (Tabla) */}
              {viewMode === "lista" ? (
                <div className="border-2 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Caravana
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Nombre
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Categoría
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Raza
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Edad
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Salud
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAnimals.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                              No se encontraron animales
                            </td>
                          </tr>
                        ) : (
                          filteredAnimals.map((animal: any) => (
                            <tr
                              key={animal.id}
                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => handleAnimalSelect(animal)}
                            >
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm font-medium text-gray-900">
                                  {animal.tagNumber || animal.caravanaVisual || "N/A"}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm text-gray-900">
                                  {animal.name || "Sin nombre"}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={getCategoryColor(animal.category || "")}
                                >
                                  {animal.category || "N/A"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm text-gray-600">
                                  {animal.breed || animal.raza?.nombre || "N/A"}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm text-gray-600">
                                  {animal.age || animal.edad || "N/A"}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={
                                    animal.reproductiveStatus === "Preñada"
                                      ? "bg-green-100 text-green-800 border-green-200"
                                      : "bg-gray-100 text-gray-800 border-gray-200"
                                  }
                                >
                                  {animal.reproductiveStatus || "N/A"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={getHealthStatusColor(animal.healthStatus || "")}
                                >
                                  {animal.healthStatus || "Saludable"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAnimalSelect(animal)
                                  }}
                                >
                                  Ver detalles
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Vista de Tarjetas */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAnimals.map((animal) => (
                    <AnimalCard 
                      key={animal.id} 
                      animal={animal} 
                      onSelect={handleAnimalSelect}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="detalle" className="mt-6">
              {/* Detalle del Animal Seleccionado */}
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
                    <TabsList className="grid w-full grid-cols-6 border-2 border-gray-200">
                      <TabsTrigger value="peso" className="border-r-2 border-gray-200">
                        Peso & Crecimiento
                      </TabsTrigger>
                      <TabsTrigger value="reproduccion" className="border-r-2 border-gray-200">
                        Reproducción
                      </TabsTrigger>
                      <TabsTrigger value="salud" className="border-r-2 border-gray-200">
                        Salud
                      </TabsTrigger>
                      <TabsTrigger value="nutricion" className="border-r-2 border-gray-200">
                        Nutrición
                      </TabsTrigger>
                      <TabsTrigger value="genetica" className="border-r-2 border-gray-200">
                        Genética
                      </TabsTrigger>
                      <TabsTrigger value="economia">Economía</TabsTrigger>
                    </TabsList>

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
                                <p className="text-3xl font-bold text-blue-600">{selectedAnimal.weight}</p>
                                <p className="text-sm text-gray-600">kg Peso Vivo</p>
                              </div>
                              <div className="text-center p-4 border-2 border-gray-100 rounded-lg">
                                <p className="text-3xl font-bold text-green-600">+{selectedAnimal.dailyGain}</p>
                                <p className="text-sm text-gray-600">kg/día GDP</p>
                              </div>
                              <div className="text-center p-4 border-2 border-gray-100 rounded-lg">
                                <p className="text-3xl font-bold text-purple-600">
                                  {selectedAnimal.bodyConditionScore}
                                </p>
                                <p className="text-sm text-gray-600">CC (1-9)</p>
                              </div>
                              <div className="text-center p-4 border-2 border-gray-100 rounded-lg">
                                <p className="text-3xl font-bold text-orange-600">{selectedAnimal.feedEfficiency}</p>
                                <p className="text-sm text-gray-600">Conversión</p>
                              </div>
                            </div>

                            <div className="mt-6">
                              <h4 className="font-semibold mb-3">Curva de Crecimiento</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Peso al nacer:</span>
                                  <span className="font-semibold">38 kg</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Peso al destete:</span>
                                  <span className="font-semibold">285 kg</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Peso al año:</span>
                                  <span className="font-semibold">420 kg</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Peso proyectado adulto:</span>
                                  <span className="font-semibold text-green-600">950 kg</span>
                                </div>
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
                              {livestockData.weightRecords.map((record, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-3 border-2 border-gray-100 rounded-lg"
                                >
                                  <div>
                                    <p className="font-semibold">{new Date(record.date).toLocaleDateString()}</p>
                                    <p className="text-sm text-gray-600">
                                      GDP: +{record.gain} kg/día | CC: {record.bodyCondition}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-blue-600">{record.weight} kg</p>
                                    <p className="text-xs text-gray-600">Peso vivo</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

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
                                {selectedAnimal.reproductiveStatus}
                              </Badge>
                              <p className="text-gray-600 mt-2">Toro reproductor de élite</p>
                            </div>

                            <div className="space-y-4">
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Descendencia total:</span>
                                <span className="font-semibold">{selectedAnimal.offspring}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Progenie esperada 2024:</span>
                                <span className="font-semibold">{selectedAnimal.expectedProgeny}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Tasa de preñez:</span>
                                <span className="font-semibold text-green-600">95%</span>
                              </div>
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Facilidad de parto:</span>
                                <span className="font-semibold text-green-600">Excelente</span>
                              </div>
                            </div>

                            <div className="mt-6">
                              <div className="flex justify-between text-sm mb-2">
                                <span>Temporada reproductiva 2024</span>
                                <span>85% completada</span>
                              </div>
                              <Progress value={85} className="h-3" />
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
                              {livestockData.reproductiveHistory.map((event, index) => (
                                <div key={index} className="p-3 border-2 border-gray-100 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold">{event.event}</span>
                                    <span className="text-sm text-gray-600">
                                      {new Date(event.date).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2">{event.details}</p>
                                  <Badge
                                    variant="outline"
                                    className={
                                      event.outcome === "Exitoso" ||
                                      event.outcome === "Apto para reproducción" ||
                                      event.outcome === "100% viabilidad"
                                        ? "bg-green-100 text-green-800 border-green-200"
                                        : "bg-gray-100 text-gray-800 border-gray-200"
                                    }
                                  >
                                    {event.outcome}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="salud" className="mt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <Stethoscope className="h-5 w-5 text-red-600" />
                              Estado de Salud Actual
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="text-center p-4 border-2 border-gray-100 rounded-lg">
                                <Weight className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                <p className="text-2xl font-bold">{selectedAnimal.weight}</p>
                                <p className="text-sm text-gray-600">kg</p>
                              </div>
                              <div className="text-center p-4 border-2 border-gray-100 rounded-lg">
                                <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
                                <p
                                  className={`text-2xl font-bold ${getBodyConditionColor(selectedAnimal.bodyConditionScore)}`}
                                >
                                  {selectedAnimal.bodyConditionScore}
                                </p>
                                <p className="text-sm text-gray-600">CC (1-9)</p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Temperatura corporal:</span>
                                <span className="font-semibold text-green-600">38.8°C</span>
                              </div>
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Frecuencia cardíaca:</span>
                                <span className="font-semibold text-green-600">65 lpm</span>
                              </div>
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Frecuencia respiratoria:</span>
                                <span className="font-semibold text-green-600">24 rpm</span>
                              </div>
                              <div className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg">
                                <span className="text-gray-600">Última vacunación:</span>
                                <span className="font-semibold">
                                  {new Date(selectedAnimal.lastVaccination).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div className="mt-6 p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <span className="font-semibold text-green-800">Estado general: Excelente</span>
                              </div>
                              <p className="text-sm text-green-700 mt-1">
                                Próxima vacunación programada:{" "}
                                {new Date(selectedAnimal.nextVaccination).toLocaleDateString()}
                              </p>
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
                              {livestockData.healthRecords.map((record, index) => (
                                <div key={index} className="p-3 border-2 border-gray-100 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                                      {record.type}
                                    </Badge>
                                    <span className="text-sm text-gray-600">
                                      {new Date(record.date).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <h4 className="font-semibold mb-1">{record.treatment}</h4>
                                  <p className="text-sm text-gray-600 mb-2">{record.notes}</p>
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Veterinario: {record.veterinarian}</span>
                                    <span className="font-semibold">${record.cost.toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="nutricion" className="mt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <Wheat className="h-5 w-5 text-amber-600" />
                              Plan Nutricional
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                                <p className="text-xl font-bold text-amber-600">
                                  {livestockData.nutritionPlan.dailyDryMatter}
                                </p>
                                <p className="text-sm text-gray-600">kg MS/día</p>
                              </div>
                              <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                                <p className="text-xl font-bold text-green-600">
                                  {livestockData.nutritionPlan.crudeProtein}%
                                </p>
                                <p className="text-sm text-gray-600">Proteína Cruda</p>
                              </div>
                              <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                                <p className="text-xl font-bold text-blue-600">
                                  {livestockData.nutritionPlan.metabolizableEnergy}
                                </p>
                                <p className="text-sm text-gray-600">Mcal EM/kg</p>
                              </div>
                              <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                                <p className="text-xl font-bold text-purple-600">
                                  {livestockData.nutritionPlan.neutralDetergentFiber}%
                                </p>
                                <p className="text-sm text-gray-600">FDN</p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex justify-between items-center p-2 border-2 border-gray-100 rounded">
                                <span className="text-gray-600">Calcio:</span>
                                <span className="font-semibold">{livestockData.nutritionPlan.calcium}%</span>
                              </div>
                              <div className="flex justify-between items-center p-2 border-2 border-gray-100 rounded">
                                <span className="text-gray-600">Fósforo:</span>
                                <span className="font-semibold">{livestockData.nutritionPlan.phosphorus}%</span>
                              </div>
                              <div className="flex justify-between items-center p-2 border-2 border-gray-100 rounded">
                                <span className="text-gray-600">Conversión alimenticia:</span>
                                <span className="font-semibold text-green-600">
                                  {livestockData.nutritionPlan.feedEfficiency}:1
                                </span>
                              </div>
                              <div className="flex justify-between items-center p-2 border-2 border-gray-100 rounded">
                                <span className="text-gray-600">Costo diario alimentación:</span>
                                <span className="font-semibold">${livestockData.nutritionPlan.feedCost}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <BarChart3 className="h-5 w-5 text-green-600" />
                              Composición de la Dieta
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="space-y-3">
                              {livestockData.nutritionPlan.ration.map((ingredient, index) => (
                                <div key={index} className="p-3 border-2 border-gray-100 rounded-lg">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium">{ingredient.ingredient}</span>
                                    <span className="text-sm text-gray-600">{ingredient.amount} kg</span>
                                  </div>
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                      <div
                                        className="bg-green-500 h-2 rounded-full"
                                        style={{ width: `${ingredient.percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-semibold">{ingredient.percentage}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-6 p-3 bg-amber-50 border-2 border-amber-200 rounded-lg">
                              <p className="text-sm text-amber-800">
                                <strong>Recomendación:</strong> Dieta balanceada para toro reproductor. Mantener
                                condición corporal entre 6.5-7.5 para óptimo desempeño reproductivo.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

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
                              <p className="text-3xl font-bold text-purple-600">{selectedAnimal.geneticValue}</p>
                              <p className="text-gray-600">Índice Genético Total</p>
                              <div className="mt-2">
                                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                                  Confiabilidad: {livestockData.geneticData.genomicReliability}%
                                </Badge>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {Object.entries(livestockData.geneticData.breedingValues).map(([trait, value], index) => (
                                <div
                                  key={index}
                                  className="flex justify-between items-center p-3 border-2 border-gray-100 rounded-lg"
                                >
                                  <span className="text-gray-600">
                                    {trait.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}:
                                  </span>
                                  <span
                                    className={`font-semibold ${value.startsWith("+") ? "text-green-600" : value.startsWith("-") ? "text-red-600" : "text-blue-600"}`}
                                  >
                                    {value}
                                  </span>
                                </div>
                              ))}
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
                                  <p className="font-medium">{livestockData.geneticData.pedigree.sire}</p>
                                </div>
                                <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                                  <h4 className="font-semibold text-gray-700">Madre</h4>
                                  <p className="font-medium">{livestockData.geneticData.pedigree.dam}</p>
                                </div>
                              </div>

                              <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                                <h4 className="font-semibold text-gray-700">Abuelo Materno</h4>
                                <p className="font-medium">{livestockData.geneticData.pedigree.maternalGrandSire}</p>
                              </div>
                            </div>

                            <div className="mt-6 p-3 bg-purple-50 border-2 border-purple-200 rounded-lg">
                              <p className="text-sm text-purple-800">
                                <strong>Recomendación:</strong> Excelente toro reproductor con valores genéticos
                                superiores para crecimiento y calidad de carne. Ideal para mejoramiento del rodeo.
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="economia" className="mt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <TrendingUp className="h-5 w-5 text-green-600" />
                              Análisis Económico
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                                <p className="text-xl font-bold text-green-600">${selectedAnimal.marketValue}</p>
                                <p className="text-sm text-gray-600">Valor actual</p>
                              </div>
                              <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                                <p className="text-xl font-bold text-red-600">$12.50</p>
                                <p className="text-sm text-gray-600">Costo diario</p>
                              </div>
                              <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                                <p className="text-xl font-bold text-blue-600">$4.20</p>
                                <p className="text-sm text-gray-600">$/kg peso vivo</p>
                              </div>
                              <div className="text-center p-3 border-2 border-gray-100 rounded-lg">
                                <p className="text-xl font-bold text-purple-600">$1.85</p>
                                <p className="text-sm text-gray-600">Costo/kg ganancia</p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex justify-between items-center p-2 border-2 border-gray-100 rounded">
                                <span className="text-gray-600">Costo alimentación:</span>
                                <span className="font-semibold">$12.50/día</span>
                              </div>
                              <div className="flex justify-between items-center p-2 border-2 border-gray-100 rounded">
                                <span className="text-gray-600">Costo sanitario:</span>
                                <span className="font-semibold">$0.85/día</span>
                              </div>
                              <div className="flex justify-between items-center p-2 border-2 border-gray-100 rounded">
                                <span className="text-gray-600">Otros costos:</span>
                                <span className="font-semibold">$1.20/día</span>
                              </div>
                              <div className="flex justify-between items-center p-2 border-2 border-green-100 bg-green-50 rounded">
                                <span className="text-green-700 font-medium">Valor genético:</span>
                                <span className="font-bold text-green-700">Superior</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-2 border-gray-200">
                          <CardHeader className="border-b-2 border-gray-100">
                            <CardTitle className="flex items-center gap-2">
                              <BarChart3 className="h-5 w-5 text-blue-600" />
                              Indicadores de Eficiencia
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Eficiencia reproductiva</span>
                                  <span className="text-green-600">95%</span>
                                </div>
                                <Progress value={95} className="h-2" />
                              </div>

                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Conversión alimenticia</span>
                                  <span className="text-green-600">92%</span>
                                </div>
                                <Progress value={92} className="h-2" />
                              </div>

                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Ganancia de peso</span>
                                  <span className="text-blue-600">88%</span>
                                </div>
                                <Progress value={88} className="h-2" />
                              </div>

                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Valor genético</span>
                                  <span className="text-green-600">96%</span>
                                </div>
                                <Progress value={96} className="h-2" />
                              </div>
                            </div>

                            <div className="mt-6 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                              <p className="text-sm text-blue-800">
                                <strong>Análisis:</strong> Toro reproductor de alto valor genético y económico.
                                Excelente inversión para mejoramiento del rodeo y producción de carne de calidad.
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
                <Card className="border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <Weight className="h-5 w-5 text-blue-600" />
                      Reporte de Peso y Crecimiento
                    </CardTitle>
                    <CardDescription>Análisis de ganancia de peso y desarrollo</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye curvas de crecimiento, GDP promedio y proyecciones de peso.
                    </p>
                    <Button className="w-full">Generar Reporte</Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:border-green-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-600" />
                      Reporte Reproductivo
                    </CardTitle>
                    <CardDescription>Eficiencia reproductiva del rodeo</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye tasas de preñez, parición y eficiencia de toros reproductores.
                    </p>
                    <Button className="w-full">Generar Reporte</Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-purple-600" />
                      Reporte Sanitario
                    </CardTitle>
                    <CardDescription>Historial de salud y tratamientos</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye vacunaciones, desparasitaciones y costos veterinarios.
                    </p>
                    <Button className="w-full">Generar Reporte</Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:border-amber-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <Wheat className="h-5 w-5 text-amber-600" />
                      Reporte Nutricional
                    </CardTitle>
                    <CardDescription>Análisis de alimentación y conversión</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye eficiencia alimenticia, costos de ración y recomendaciones nutricionales.
                    </p>
                    <Button className="w-full">Generar Reporte</Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:border-green-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Reporte Económico
                    </CardTitle>
                    <CardDescription>Análisis de rentabilidad y costos</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye valores de mercado, costos de producción y ROI por animal.
                    </p>
                    <Button className="w-full">Generar Reporte</Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all cursor-pointer">
                  <CardHeader className="border-b-2 border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-indigo-600" />
                      Reporte Genético
                    </CardTitle>
                    <CardDescription>Valores genéticos y genealogías</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Incluye DEPs, pedigrí y recomendaciones de apareamiento para mejoramiento genético.
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

