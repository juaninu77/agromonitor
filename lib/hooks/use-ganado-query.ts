"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

export interface AnimalAPI {
  id: string
  cuig?: string
  caravanaVisual?: string
  caravanaRfid?: string
  nombre: string
  sexo: "M" | "F"
  fechaNacimiento?: string
  edad?: string
  origen: string
  colorManto?: string
  estadoCastracion?: string
  denticion?: string
  esCabana: boolean
  registroCabana?: string
  notas?: string
  especie?: { id: string; nombre: string }
  raza?: { id: string; nombre: string }
  categoria?: { id: string; nombre: string }
  pesoActual?: number
  ccActual?: number
  ubicacion?: string
  lote?: string
  weight: number
  bodyConditionScore: number
  healthStatus: string
  dailyGain: number
  breed: string
  category: string
  tagNumber: string
  location: string
  marketValue: number
  alerts: string[]
  name?: string
  feedEfficiency?: number
  reproductiveStatus?: string
  offspring?: number
  expectedProgeny?: number
  geneticValue?: number
  lastVaccination?: string
  nextVaccination?: string
  birthDate?: string
  age?: string
}

export interface GanadoStats {
  total: number
  porCategoria: Record<string, number>
  pesoPromedio: number
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface GanadoResponse {
  success: boolean
  data: AnimalAPI[]
  stats: GanadoStats
  pagination: PaginationInfo
}

async function fetchGanado(params: {
  page: number
  limit: number
  orderBy: string
  orderDirection: "asc" | "desc"
  establecimientoId?: string
}): Promise<GanadoResponse> {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
    orderBy: params.orderBy,
    orderDirection: params.orderDirection,
  })

  if (params.establecimientoId) {
    searchParams.set("establecimientoId", params.establecimientoId)
  }

  const response = await fetch(`/api/ganado/bovinos?${searchParams}`)

  if (!response.ok) {
    if (response.status === 401) throw new Error("No autenticado")
    throw new Error(`Error ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) throw new Error(data.error || "Error al cargar datos")

  data.data = data.data.map((animal: AnimalAPI) => ({
    ...animal,
    name: animal.nombre,
    birthDate: animal.fechaNacimiento,
    age: animal.edad || "",
  }))

  return data
}

export function useGanadoQuery(establecimientoId?: string) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [orderBy, setOrderBy] = useState("caravana")
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("asc")

  const query = useQuery({
    queryKey: ["ganado", "bovinos", { page, limit, orderBy, orderDirection, establecimientoId }],
    queryFn: () => fetchGanado({ page, limit, orderBy, orderDirection, establecimientoId }),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  })

  return {
    animales: query.data?.data ?? [],
    stats: query.data?.stats ?? null,
    pagination: query.data?.pagination ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    setPage,
    setLimit,
    setOrderBy,
    setOrderDirection,
    orderBy,
    orderDirection,
  }
}

export function useHerdOverviewQuery(establecimientoId?: string) {
  const { stats, isLoading, error } = useGanadoQuery(establecimientoId)

  const herdOverview = {
    totalAnimals: stats?.total || 0,
    breedingCows: stats?.porCategoria?.["vaca"] || 0,
    bulls: stats?.porCategoria?.["toro"] || 0,
    steers: stats?.porCategoria?.["novillo"] || 0,
    heifers: stats?.porCategoria?.["vaquillona"] || 0,
    calves:
      (stats?.porCategoria?.["ternero"] || 0) +
      (stats?.porCategoria?.["ternera"] || 0),
    averageWeight: stats?.pesoPromedio || 0,
    averageDailyGain: 0,
    calvingRate: 0,
    mortalityRate: 0,
    averageBodyCondition: 0,
  }

  return { herdOverview, isLoading, error }
}
