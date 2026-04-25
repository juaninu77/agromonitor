"use client"

import { useEffect, useState } from "react"
import { useTenant } from "@/lib/context/tenant-context"

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
  const { establecimientoActivo, organizacionActiva } = useTenant()
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    if (!enabled || !establecimientoActivo) {
      setData([])
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const url = new URL(endpoint, window.location.origin)
      url.searchParams.set("establecimientoId", establecimientoActivo.id)
      if (organizacionActiva) {
        url.searchParams.set("organizacionId", organizacionActiva.id)
      }

      const response = await fetch(url.toString())

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      let result = await response.json()

      if (result.data) {
        result = result.data
      }

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

  useEffect(() => {
    fetchData()
  }, [establecimientoActivo?.id, enabled])

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  }
}

export function useBovinos() {
  return useFilteredData<{
    id: string
    cuig: string | null
    caravanaVisual: string | null
    categoria: { nombre: string } | null
    raza: { nombre: string } | null
    estadoVital: string
  }>({
    endpoint: "/api/ganado/bovinos",
  })
}

export function useOvinos() {
  return useFilteredData<{
    id: string
    caravanaVisual: string | null
    categoria: { nombre: string } | null
    raza: { nombre: string } | null
    estadoVital: string
  }>({
    endpoint: "/api/ganado/ovinos",
  })
}
