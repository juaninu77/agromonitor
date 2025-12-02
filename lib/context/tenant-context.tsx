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

interface Campo {
  id: string
  nombre: string
  hectareas: number
  renspa?: string
}

interface TenantContextType {
  // Estado actual
  organizacionActiva: Organizacion | null
  campoActivo: Campo | null
  
  // Listas disponibles
  organizaciones: Organizacion[]
  campos: Campo[]
  
  // Acciones
  setOrganizacionActiva: (org: Organizacion | null) => void
  setCampoActivo: (campo: Campo | null) => void
  
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
  const [campos, setCampos] = useState<Campo[]>([])
  const [organizacionActiva, setOrganizacionActivaState] = useState<Organizacion | null>(null)
  const [campoActivo, setCampoActivoState] = useState<Campo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar organizaciones del usuario
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      fetchOrganizaciones()
    } else if (status === "unauthenticated") {
      setIsLoading(false)
    }
  }, [status, session])

  // Cargar campos cuando cambia la organización
  useEffect(() => {
    if (organizacionActiva) {
      fetchCampos(organizacionActiva.id)
    } else {
      setCampos([])
      setCampoActivoState(null)
    }
  }, [organizacionActiva])

  const fetchOrganizaciones = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/organizaciones")
      
      if (!response.ok) {
        throw new Error("Error al cargar organizaciones")
      }
      
      const data = await response.json()
      setOrganizaciones(data)
      
      // Seleccionar la primera organización por defecto
      if (data.length > 0 && !organizacionActiva) {
        setOrganizacionActivaState(data[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCampos = async (organizacionId: string) => {
    try {
      const response = await fetch(`/api/organizaciones/${organizacionId}/campos`)
      
      if (!response.ok) {
        throw new Error("Error al cargar campos")
      }
      
      const data = await response.json()
      setCampos(data)
      
      // Seleccionar el primer campo por defecto
      if (data.length > 0 && !campoActivo) {
        setCampoActivoState(data[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    }
  }

  const setOrganizacionActiva = useCallback((org: Organizacion | null) => {
    setOrganizacionActivaState(org)
    setCampoActivoState(null) // Resetear campo al cambiar organización
    
    // Guardar en localStorage para persistencia
    if (org) {
      localStorage.setItem("organizacionActivaId", org.id)
    } else {
      localStorage.removeItem("organizacionActivaId")
    }
  }, [])

  const setCampoActivo = useCallback((campo: Campo | null) => {
    setCampoActivoState(campo)
    
    // Guardar en localStorage para persistencia
    if (campo) {
      localStorage.setItem("campoActivoId", campo.id)
    } else {
      localStorage.removeItem("campoActivoId")
    }
  }, [])

  return (
    <TenantContext.Provider
      value={{
        organizacionActiva,
        campoActivo,
        organizaciones,
        campos,
        setOrganizacionActiva,
        setCampoActivo,
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
// HOOK AUXILIAR: Solo campo activo
// ============================================

export function useCampoActivo() {
  const { campoActivo, isLoading } = useTenant()
  return { campoActivo, isLoading }
}

