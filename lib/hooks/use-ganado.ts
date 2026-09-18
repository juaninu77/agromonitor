"use client"

import { useQuery } from "@tanstack/react-query"
import { ganadoParams, type GanadoQuery } from "@/lib/ganado/query"

// Tipos para los datos de la API
export interface AnimalAPI {
  id: string
  cuig?: string
  caravanaVisual?: string
  caravanaRfid?: string
  estadoVital: string
  establecimientoId: string
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
  // Campos de compatibilidad con UI existente
  weight: number
  bodyConditionScore: number
  healthStatus: string
  dailyGain: number
  breed: string
  category: string
  tagNumber: string
  location: string
  marketValue: number | null
  alerts: string[]
  // Campos adicionales para UI
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
  conPeso: number
  activos: number
  pesoPorCategoria: { category: string; avgWeight: number; count: number }[]
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export function useGanado(filters: GanadoQuery) {
  const params = filters.establecimientoId
    ? ganadoParams(filters).toString()
    : ""
  const query = useQuery({
    queryKey: ["ganado-lista", params],
    enabled: !!params,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/ganado/bovinos?${params}`, { signal })
      const result = await response.json()
      if (!response.ok || !result.success)
        throw new Error(result.error || "No se pudo cargar el ganado")
      return result as {
        data: AnimalAPI[]
        stats: GanadoStats
        pagination: PaginationInfo
      }
    },
  })
  return {
    animales: query.data?.data ?? [],
    stats: query.data?.stats ?? null,
    pagination: query.data?.pagination ?? null,
    isLoading: query.isFetching,
    error: query.error?.message ?? null,
    refetch: async () => {
      await query.refetch()
    },
  }
}
