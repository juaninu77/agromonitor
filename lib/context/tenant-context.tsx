"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"

// ============================================
// TIPOS
// ============================================

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
  // Estado actual
  organizacionActiva: Organizacion | null
  establecimientoActivo: Establecimiento | null
  
  // Listas disponibles
  organizaciones: Organizacion[]
  establecimientos: Establecimiento[]
  
  // Acciones
  setOrganizacionActiva: (org: Organizacion | null) => void
  setEstablecimientoActivo: (establecimiento: Establecimiento | null) => void
  fetchEstablecimientos: (organizacionId: string) => Promise<void>
  
  // Estados de carga
  isLoading: boolean
  error: string | null
}

// ============================================
// CONTEXTO
// ============================================

const TenantContext = createContext<TenantContextType | undefined>(undefined)

// ============================================
// PROVEEDOR
// ============================================

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  
  // Estado
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([])
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([])
  const [organizacionActiva, setOrganizacionActivaState] = useState<Organizacion | null>(null)
  const [establecimientoActivo, setEstablecimientoActivoState] = useState<Establecimiento | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false) // Evitar recargas innecesarias

  // Restaurar desde localStorage al inicio (solo una vez)
  useEffect(() => {
    if (typeof window !== "undefined" && !hasLoaded) {
      const savedOrgId = localStorage.getItem("organizacionActivaId")
      const savedEstId = localStorage.getItem("establecimientoActivoId")
      
      // Si hay IDs guardados, los usaremos cuando carguen los datos
      if (savedOrgId || savedEstId) {
        // Solo marcar que ya intentamos restaurar
        setHasLoaded(true)
      }
    }
  }, [hasLoaded])

  const fetchOrganizaciones = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/organizaciones")
      
      if (!response.ok) {
        throw new Error("Error al cargar organizaciones")
      }
      
      const data = await response.json()
      setOrganizaciones(data)
      setHasLoaded(true)
      
      // Restaurar organización desde localStorage o usar la primera
      const savedOrgId = typeof window !== "undefined" ? localStorage.getItem("organizacionActivaId") : null
      const orgToSelect = savedOrgId 
        ? data.find((org: Organizacion) => org.id === savedOrgId) || data[0]
        : data[0]
      
      // Solo establecer si no hay una organización activa
      setOrganizacionActivaState((prev) => {
        if (!prev && orgToSelect) {
          return orgToSelect
        }
        return prev
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
      setHasLoaded(true) // Marcar como cargado incluso si hay error
    } finally {
      setIsLoading(false)
    }
  }, []) // Sin dependencias para evitar recargas

  const fetchEstablecimientos = useCallback(async (organizacionId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/organizaciones/${organizacionId}/establecimientos`)

      if (!response.ok) {
        throw new Error("Error al cargar establecimientos")
      }

      const data = await response.json()
      setEstablecimientos(data)

      // Restaurar establecimiento desde localStorage o usar el primero
      const savedEstId = typeof window !== "undefined" ? localStorage.getItem("establecimientoActivoId") : null
      const estToSelect = savedEstId
        ? data.find((est: Establecimiento) => est.id === savedEstId) || data[0]
        : data[0]

      if (estToSelect) {
        setEstablecimientoActivoState(estToSelect)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar establecimientos")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Cargar organizaciones del usuario (solo una vez cuando se autentica)
  useEffect(() => {
    if (status === "authenticated" && session?.user && !hasLoaded) {
      fetchOrganizaciones()
    } else if (status === "unauthenticated") {
      setIsLoading(false)
      setHasLoaded(false) // Reset para próxima sesión
    }
  }, [status, session?.user?.id, hasLoaded, fetchOrganizaciones]) // Solo depende del user.id, no de toda la sesión

  // Cargar establecimientos cuando cambia la organización
  useEffect(() => {
    if (organizacionActiva) {
      fetchEstablecimientos(organizacionActiva.id)
    } else {
      setEstablecimientos([])
      setEstablecimientoActivoState(null)
    }
  }, [organizacionActiva, fetchEstablecimientos])


  const setOrganizacionActiva = useCallback((org: Organizacion | null) => {
    setOrganizacionActivaState(org)
    setEstablecimientoActivoState(null) // Resetear establecimiento al cambiar organización
    
    // Guardar en localStorage para persistencia
    if (org) {
      localStorage.setItem("organizacionActivaId", org.id)
    } else {
      localStorage.removeItem("organizacionActivaId")
    }
  }, [])

  const setEstablecimientoActivo = useCallback((establecimiento: Establecimiento | null) => {
    setEstablecimientoActivoState(establecimiento)
    
    // Guardar en localStorage para persistencia
    if (establecimiento) {
      localStorage.setItem("establecimientoActivoId", establecimiento.id)
    } else {
      localStorage.removeItem("establecimientoActivoId")
    }
  }, [])

  return (
    <TenantContext.Provider
      value={{
        organizacionActiva,
        establecimientoActivo,
        organizaciones,
        establecimientos,
        setOrganizacionActiva,
        setEstablecimientoActivo,
        fetchEstablecimientos,
        isLoading,
        error,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

// ============================================
// HOOK
// ============================================

export function useTenant() {
  const context = useContext(TenantContext)
  
  if (context === undefined) {
    throw new Error("useTenant debe usarse dentro de un TenantProvider")
  }
  
  return context
}

// ============================================
// HOOK AUXILIAR: Solo establecimiento activo
// ============================================

export function useEstablecimientoActivo() {
  const { establecimientoActivo, isLoading } = useTenant()
  return { establecimientoActivo, isLoading }
}

