"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTenant } from "@/lib/context/tenant-context"
import { Loader2 } from "lucide-react"

/**
 * Componente que verifica si el usuario necesita completar el onboarding
 * y redirige automáticamente si es necesario
 */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { establecimientos, isLoading } = useTenant()
  const [checking, setChecking] = useState(true)
  const hasCheckedRef = useRef(false) // Evitar múltiples verificaciones

  // Rutas que no requieren verificación de onboarding (memoizado)
  const allowedRoutes = useMemo(() => [
    "/configuracion/onboarding",
    "/configuracion/establecimientos",
    "/configuracion/establecimientos/",
  ], [])

  const isAllowedRoute = useMemo(() => 
    allowedRoutes.some((route) => pathname?.startsWith(route)),
    [pathname, allowedRoutes]
  )

  useEffect(() => {
    // Evitar verificaciones múltiples en la misma ruta
    if (hasCheckedRef.current && checking === false) {
      return
    }

    const checkOnboarding = async () => {
      // Esperar a que la sesión y el tenant estén cargados
      if (status === "loading" || isLoading) {
        return
      }

      // Si no está autenticado, no hacer nada
      if (status === "unauthenticated") {
        setChecking(false)
        hasCheckedRef.current = true
        return
      }

      // Si está en una ruta permitida, no redirigir
      if (isAllowedRoute) {
        setChecking(false)
        hasCheckedRef.current = true
        return
      }

      // Verificar si tiene establecimientos
      // Si no tiene establecimientos o el establecimiento no tiene lotes, redirigir al onboarding
      if (establecimientos.length === 0) {
        hasCheckedRef.current = true
        router.push("/configuracion/onboarding")
        return
      }

      // Verificar si el establecimiento tiene lotes
      // Por ahora, solo verificamos que tenga establecimientos
      // Podríamos agregar verificación de lotes más adelante
      setChecking(false)
      hasCheckedRef.current = true
    }

    checkOnboarding()
  }, [status, isLoading, establecimientos.length, isAllowedRoute, router, checking])

  // Resetear el ref cuando cambia la ruta
  useEffect(() => {
    hasCheckedRef.current = false
  }, [pathname])

  // Mostrar loading mientras se verifica
  if (checking || status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

