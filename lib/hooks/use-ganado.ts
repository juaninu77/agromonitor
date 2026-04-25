"use client"

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

// Tipos para los datos de la API
export interface AnimalAPI {
  id: string
  cuig?: string
  caravanaVisual?: string
  caravanaRfid?: string
  nombre: string
  sexo: 'M' | 'F'
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
  marketValue: number
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
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface UseGanadoResult {
  animales: AnimalAPI[]
  stats: GanadoStats | null
  pagination: PaginationInfo | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setOrderBy: (field: string) => void
  setOrderDirection: (direction: 'asc' | 'desc') => void
  orderBy: string
  orderDirection: 'asc' | 'desc'
}

/**
 * Hook para cargar datos de ganado bovino desde la API
 */
export function useGanado(): UseGanadoResult {
  const [animales, setAnimales] = useState<AnimalAPI[]>([])
  const [stats, setStats] = useState<GanadoStats | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [orderBy, setOrderBy] = useState('caravana')
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('asc')

  const fetchGanado = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        orderBy: orderBy,
        orderDirection: orderDirection,
      })

      const response = await fetch(`/api/ganado/bovinos?${params}`)
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('No autenticado')
          return
        }
        throw new Error(`Error ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        // Transformar datos para compatibilidad con UI existente
        const animalesTransformados = data.data.map((animal: AnimalAPI) => ({
          ...animal,
          name: animal.nombre,
          birthDate: animal.fechaNacimiento,
          age: animal.edad || '',
        }))

        setAnimales(animalesTransformados)
        setStats(data.stats)
        setPagination(data.pagination)
      } else {
        throw new Error(data.error || 'Error al cargar datos')
      }
    } catch (err) {
      console.error('Error fetching ganado:', err)
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)

      // Mostrar toast de error
      toast.error('Error al cargar datos', {
        description: errorMessage,
        duration: 5000,
      })
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, orderBy, orderDirection])

  useEffect(() => {
    fetchGanado()
  }, [fetchGanado])

  return {
    animales,
    stats,
    pagination,
    isLoading,
    error,
    refetch: fetchGanado,
    setPage,
    setLimit,
    setOrderBy,
    setOrderDirection,
    orderBy,
    orderDirection,
  }
}

/**
 * Hook para obtener el resumen del rodeo
 */
export function useHerdOverview() {
  const { animales, stats, isLoading, error } = useGanado()

  const herdOverview = {
    totalAnimals: stats?.total || 0,
    breedingCows: stats?.porCategoria?.['vaca'] || 0,
    bulls: stats?.porCategoria?.['toro'] || 0,
    steers: stats?.porCategoria?.['novillo'] || 0,
    heifers: stats?.porCategoria?.['vaquillona'] || 0,
    calves: (stats?.porCategoria?.['ternero'] || 0) + (stats?.porCategoria?.['ternera'] || 0),
    averageWeight: stats?.pesoPromedio || 0,
    averageDailyGain: 0, // TODO: calcular desde pesadas
    calvingRate: 0, // TODO: calcular desde pariciones
    mortalityRate: 0, // TODO: calcular desde bajas
    averageBodyCondition: 0, // TODO: calcular desde pesadas
  }

  return {
    herdOverview,
    isLoading,
    error,
  }
}

