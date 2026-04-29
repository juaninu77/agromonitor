"use client"

import { memo, useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, List, Grid3x3 } from "lucide-react"
import { getCategoryColor, getHealthStatusColor } from "@/lib/utils/livestock-helpers"
import { AnimalCard } from "./animal-card"
import { LoadingState } from "./loading-state"
import { DataPagination } from "./data-pagination"
import { SortableHeader } from "./sortable-header"
import { EmptyGanadoState } from "@/components/ganado/empty-ganado-state"

interface AnimalListTabProps {
  animals: any[]
  isLoading: boolean
  pagination: any
  orderBy: string
  orderDirection: "asc" | "desc"
  totalLotes: number
  onAnimalSelect: (animal: any) => void
  onOpenEdit: (id: string) => void
  onSort: (field: string) => void
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

export const AnimalListTab = memo(function AnimalListTab({
  animals,
  isLoading,
  pagination,
  orderBy,
  orderDirection,
  totalLotes,
  onAnimalSelect,
  onOpenEdit,
  onSort,
  onPageChange,
  onLimitChange,
}: AnimalListTabProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("todos")
  const [viewMode, setViewMode] = useState<"lista" | "tarjetas">("lista")

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const filteredAnimals = useMemo(() => {
    return animals.filter((animal: any) => {
      const matchesSearch =
        (animal.name?.toLowerCase() || "").includes(debouncedSearchTerm.toLowerCase()) ||
        (animal.tagNumber || "").includes(debouncedSearchTerm)

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
  }, [animals, debouncedSearchTerm, filterStatus])

  if (isLoading) {
    return (
      <LoadingState
        message="Cargando animales..."
        submessage="Obteniendo datos de la base de datos"
      />
    )
  }

  return (
    <>
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

      {filteredAnimals.length === 0 && animals.length === 0 ? (
        <EmptyGanadoState totalLotes={totalLotes} />
      ) : (
        <>
          {viewMode === "lista" ? (
            <div className="border-2 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <SortableHeader field="caravana" label="Caravana" currentOrderBy={orderBy} currentDirection={orderDirection} onSort={onSort} />
                      <SortableHeader field="nombre" label="Nombre" currentOrderBy={orderBy} currentDirection={orderDirection} onSort={onSort} />
                      <SortableHeader field="categoria" label="Categoría" currentOrderBy={orderBy} currentDirection={orderDirection} onSort={onSort} />
                      <SortableHeader field="raza" label="Raza" currentOrderBy={orderBy} currentDirection={orderDirection} onSort={onSort} />
                      <SortableHeader field="edad" label="Edad" currentOrderBy={orderBy} currentDirection={orderDirection} onSort={onSort} />
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Salud</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAnimals.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No se encontraron animales con los filtros aplicados
                        </td>
                      </tr>
                    ) : (
                      filteredAnimals.map((animal: any) => (
                        <tr
                          key={animal.id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => router.push(`/ganado/${animal.id}`)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {animal.tagNumber || animal.caravanaVisual || "N/A"}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-900">{animal.name || "Sin nombre"}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge variant="outline" className={getCategoryColor(animal.category || "")}>
                              {animal.category || "N/A"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{animal.breed || animal.raza?.nombre || "N/A"}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{animal.age || animal.edad || "N/A"}</span>
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
                            <Badge variant="outline" className={getHealthStatusColor(animal.healthStatus || "")}>
                              {animal.healthStatus || "Saludable"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/ganado/${animal.id}`)
                              }}
                            >
                              Ver ficha
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAnimals.map((animal) => (
                <AnimalCard
                  key={animal.id}
                  animal={animal}
                  onSelect={onAnimalSelect}
                  onEdit={onOpenEdit}
                />
              ))}
            </div>
          )}

          {pagination && filteredAnimals.length > 0 && (
            <DataPagination
              pagination={pagination}
              onPageChange={onPageChange}
              onLimitChange={onLimitChange}
            />
          )}
        </>
      )}
    </>
  )
})
