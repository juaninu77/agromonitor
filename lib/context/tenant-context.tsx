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

  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([])
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([])
  const [organizacionActiva, setOrganizacionActivaState] = useState<Organizacion | null>(null)
  const [establecimientoActivo, setEstablecimientoActivoState] = useState<Establecimiento | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Refs para evitar loops y fetches duplicados
  const orgsFetchedRef = useRef(false)
  const estFetchingForOrgRef = useRef<string | null>(null)
  const estFetchedForOrgRef = useRef<string | null>(null)

  const fetchEstablecimientos = useCallback(async (organizacionId: string) => {
    // Si ya estamos fetcheando para esta org o ya fetcheamos, salir
    if (estFetchingForOrgRef.current === organizacionId) return
    if (estFetchedForOrgRef.current === organizacionId) return

    estFetchingForOrgRef.current = organizacionId
    try {
      const response = await fetch(`/api/organizaciones/${organizacionId}/establecimientos`)
      if (!response.ok) throw new Error("Error al cargar establecimientos")

      const data = await response.json()

      // Verificar que seguimos en la misma org (pudo cambiar durante el fetch)
      if (estFetchingForOrgRef.current !== organizacionId) return

      estFetchedForOrgRef.current = organizacionId
      setEstablecimientos(data)

      const savedEstId = typeof window !== "undefined"
        ? localStorage.getItem("establecimientoActivoId")
        : null
      const estToSelect = savedEstId
        ? data.find((est: Establecimiento) => est.id === savedEstId) || data[0]
        : data[0]

      if (estToSelect) {
        setEstablecimientoActivoState(estToSelect)
      }
    } catch (err) {
      if (estFetchingForOrgRef.current === organizacionId) {
        setError(err instanceof Error ? err.message : "Error al cargar establecimientos")
      }
    } finally {
      if (estFetchingForOrgRef.current === organizacionId) {
        estFetchingForOrgRef.current = null
        setIsLoading(false)
      }
    }
  }, [])

  const fetchOrganizaciones = useCallback(async () => {
    if (orgsFetchedRef.current) return
    orgsFetchedRef.current = true

    try {
      setIsLoading(true)
      const response = await fetch("/api/organizaciones")
      if (!response.ok) throw new Error("Error al cargar organizaciones")

      const data = await response.json()
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
      setError(err instanceof Error ? err.message : "Error desconocido")
      setIsLoading(false)
    }
  }, [fetchEstablecimientos])

  // Efecto UNICO: cargar datos al autenticarse
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      fetchOrganizaciones()
    } else if (status === "unauthenticated") {
      setIsLoading(false)
      orgsFetchedRef.current = false
      estFetchedForOrgRef.current = null
      estFetchingForOrgRef.current = null
    }
  }, [status, fetchOrganizaciones])
  // session?.user removido como dep - status es suficiente para saber si esta autenticado

  const setOrganizacionActiva = useCallback((org: Organizacion | null) => {
    setOrganizacionActivaState(org)
    setEstablecimientoActivoState(null)
    setEstablecimientos([])

    // Resetear ref de establecimientos para permitir nuevo fetch
    estFetchedForOrgRef.current = null
    estFetchingForOrgRef.current = null

    if (org) {
      localStorage.setItem("organizacionActivaId", org.id)
      setIsLoading(true)
      fetchEstablecimientos(org.id)
    } else {
      localStorage.removeItem("organizacionActivaId")
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
