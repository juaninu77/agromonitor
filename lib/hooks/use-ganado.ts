"use client"

import { useState, useEffect, useCallback } from 'react'

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

export interface UseGanadoResult {
  animales: AnimalAPI[]
  stats: GanadoStats | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook para cargar datos de ganado bovino desde la API
 */
export function useGanado(): UseGanadoResult {
  const [animales, setAnimales] = useState<AnimalAPI[]>([])
  const [stats, setStats] = useState<GanadoStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGanado = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/ganado/bovinos')
      
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
      } else {
        throw new Error(data.error || 'Error al cargar datos')
      }
    } catch (err) {
      console.error('Error fetching ganado:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGanado()
  }, [fetchGanado])

  return {
    animales,
    stats,
    isLoading,
    error,
    refetch: fetchGanado,
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

