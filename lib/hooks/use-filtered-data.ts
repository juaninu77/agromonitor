"use client"

import { useEffect, useState } from "react"
import { useTenant } from "@/lib/context/tenant-context"

// ============================================
// HOOK: useFilteredData
// ============================================
// Este hook permite obtener datos filtrados automáticamente
// por el campo activo del usuario

interface UseFilteredDataOptions<T> {
  endpoint: string
  enabled?: boolean
  transform?: (data: T[]) => T[]
}

interface UseFilteredDataResult<T> {
  data: T[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useFilteredData<T>({
  endpoint,
  enabled = true,
  transform,
}: UseFilteredDataOptions<T>): UseFilteredDataResult<T> {
  const { campoActivo, organizacionActiva } = useTenant()
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    // No hacer fetch si no hay campo activo o si está deshabilitado
    if (!enabled || !campoActivo) {
      setData([])
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Construir URL con parámetros de filtro
      const url = new URL(endpoint, window.location.origin)
      url.searchParams.set("campoId", campoActivo.id)
      if (organizacionActiva) {
        url.searchParams.set("organizacionId", organizacionActiva.id)
      }

      const response = await fetch(url.toString())

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      let result = await response.json()

      // Aplicar transformación si existe
      if (transform) {
        result = transform(result)
      }

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
      setData([])
    } finally {
      setIsLoading(false)
    }
  }

  // Refetch cuando cambia el campo activo
  useEffect(() => {
    fetchData()
  }, [campoActivo?.id, enabled])

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  }
}

// ============================================
// HOOK: useBovinos
// ============================================

export function useBovinos() {
  return useFilteredData<{
    id: string
    cuig: string | null
    numero: string
    categoria: string
    raza: string | null
    peso: number | null
    estado: string
  }>({
    endpoint: "/api/bovinos",
  })
}

// ============================================
// HOOK: useOvinos
// ============================================

export function useOvinos() {
  return useFilteredData<{
    id: string
    idv: number
    colorMarca: string
    categoria: string
    raza: string | null
    peso: number | null
    estado: string
  }>({
    endpoint: "/api/ovinos",
  })
}

// ============================================
// HOOK: useStock
// ============================================

export function useStock() {
  return useFilteredData<{
    id: string
    tipo: string
    nombre: string
    cantidad: number
    unidad: string
    kgTotal: number | null
  }>({
    endpoint: "/api/stock",
  })
}

