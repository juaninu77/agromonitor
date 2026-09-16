"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useSession } from "next-auth/react"

interface Organizacion {
  id: string
  nombre: string
  slug: string
  logo?: string
}

interface Establecimiento {
  id: string
  nombre: string
  hectareas: number | null
  renspa?: string | null
  provincia?: string | null
  localidad?: string | null
}

interface TenantContextType {
  organizacionActiva: Organizacion | null
  establecimientoActivo: Establecimiento | null
  organizaciones: Organizacion[]
  establecimientos: Establecimiento[]
  setOrganizacionActiva: (org: Organizacion | null) => void
  setEstablecimientoActivo: (establecimiento: Establecimiento | null) => void
  fetchEstablecimientos: (organizacionId: string) => Promise<void>
  isLoading: boolean
  error: string | null
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([])
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([])
  const [organizacionActiva, setOrganizacionActivaState] = useState<Organizacion | null>(null)
  const [establecimientoActivo, setEstablecimientoActivoState] = useState<Establecimiento | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Refs para evitar loops y fetches duplicados
  const orgsFetchedRef = useRef(false)
  const estFetchingForOrgRef = useRef<string | null>(null)
  const orgRequestRef = useRef<AbortController | null>(null)
  const estRequestRef = useRef<AbortController | null>(null)

  const fetchEstablecimientos = useCallback(async (organizacionId: string) => {
    // Deduplicar solo peticiones en curso: una recarga explícita debe traer altas nuevas.
    if (estFetchingForOrgRef.current === organizacionId) return

    estRequestRef.current?.abort()
    const controller = new AbortController()
    estRequestRef.current = controller
    estFetchingForOrgRef.current = organizacionId
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/organizaciones/${organizacionId}/establecimientos`, { signal: controller.signal })
      if (!response.ok) throw new Error("Error al cargar establecimientos")

      const data = await response.json()

      // Verificar que seguimos en la misma org (pudo cambiar durante el fetch)
      if (controller.signal.aborted) return

      setEstablecimientos(data)

      const savedEstId = typeof window !== "undefined"
        ? localStorage.getItem("establecimientoActivoId")
        : null
      const estToSelect = savedEstId
        ? data.find((est: Establecimiento) => est.id === savedEstId) || data[0]
        : data[0]

      setEstablecimientoActivoState(estToSelect ?? null)
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Error al cargar establecimientos")
      }
    } finally {
      if (!controller.signal.aborted) {
        estFetchingForOrgRef.current = null
        setIsLoading(false)
      }
    }
  }, [])

  const fetchOrganizaciones = useCallback(async () => {
    if (orgsFetchedRef.current) return
    orgsFetchedRef.current = true
    const controller = new AbortController()
    orgRequestRef.current?.abort()
    orgRequestRef.current = controller

    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch("/api/organizaciones", { signal: controller.signal })
      if (!response.ok) throw new Error("Error al cargar organizaciones")

      const data = await response.json()
      if (controller.signal.aborted) return
      setOrganizaciones(data)

      const savedOrgId = typeof window !== "undefined"
        ? localStorage.getItem("organizacionActivaId")
        : null
      const orgToSelect = savedOrgId
        ? data.find((org: Organizacion) => org.id === savedOrgId) || data[0]
        : data[0]

      if (orgToSelect) {
        setOrganizacionActivaState(orgToSelect)
        // Fetch establecimientos directamente en vez de depender de un useEffect
        await fetchEstablecimientos(orgToSelect.id)
      } else {
        setIsLoading(false)
      }
    } catch (err) {
      if (controller.signal.aborted) return
      orgsFetchedRef.current = false
      setError(err instanceof Error ? err.message : "Error desconocido")
      setIsLoading(false)
    }
  }, [fetchEstablecimientos])

  // Efecto UNICO: cargar datos al autenticarse
  useEffect(() => {
    setOrganizaciones([])
    setEstablecimientos([])
    setOrganizacionActivaState(null)
    setEstablecimientoActivoState(null)
    setError(null)
    if (status === "authenticated" && userId) {
      fetchOrganizaciones()
    } else {
      setIsLoading(status === "loading")
    }
    return () => {
      orgRequestRef.current?.abort()
      estRequestRef.current?.abort()
      orgsFetchedRef.current = false
      estFetchingForOrgRef.current = null
    }
  }, [status, userId, fetchOrganizaciones])

  const setOrganizacionActiva = useCallback((org: Organizacion | null) => {
    setOrganizacionActivaState(org)
    setEstablecimientoActivoState(null)
    setEstablecimientos([])

    // Resetear ref de establecimientos para permitir nuevo fetch
    estRequestRef.current?.abort()
    estFetchingForOrgRef.current = null
    setError(null)

    if (org) {
      localStorage.setItem("organizacionActivaId", org.id)
      setIsLoading(true)
      fetchEstablecimientos(org.id)
    } else {
      localStorage.removeItem("organizacionActivaId")
      setIsLoading(false)
    }
  }, [fetchEstablecimientos])

  const setEstablecimientoActivo = useCallback((establecimiento: Establecimiento | null) => {
    setEstablecimientoActivoState(establecimiento)
    if (establecimiento) {
      localStorage.setItem("establecimientoActivoId", establecimiento.id)
    } else {
      localStorage.removeItem("establecimientoActivoId")
    }
  }, [])

  // Memoizar el valor del contexto para evitar re-renders innecesarios en consumidores
  const value = useMemo<TenantContextType>(() => ({
    organizacionActiva,
    establecimientoActivo,
    organizaciones,
    establecimientos,
    setOrganizacionActiva,
    setEstablecimientoActivo,
    fetchEstablecimientos,
    isLoading,
    error,
  }), [
    organizacionActiva,
    establecimientoActivo,
    organizaciones,
    establecimientos,
    setOrganizacionActiva,
    setEstablecimientoActivo,
    fetchEstablecimientos,
    isLoading,
    error,
  ])

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error("useTenant debe usarse dentro de un TenantProvider")
  }
  return context
}

export function useEstablecimientoActivo() {
  const { establecimientoActivo, isLoading } = useTenant()
  return { establecimientoActivo, isLoading }
}
