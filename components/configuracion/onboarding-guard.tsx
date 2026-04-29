"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTenant } from "@/lib/context/tenant-context"
import { Loader2 } from "lucide-react"

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { status } = useSession()
  const { establecimientos, isLoading } = useTenant()
  const [ready, setReady] = useState(false)
  const redirectedRef = useRef(false)

  const allowedRoutes = useMemo(() => [
    "/configuracion/onboarding",
    "/configuracion/establecimientos",
  ], [])

  const isAllowedRoute = useMemo(() =>
    allowedRoutes.some((route) => pathname?.startsWith(route)),
    [pathname, allowedRoutes]
  )

  useEffect(() => {
    if (status === "loading" || isLoading) return

    if (status === "unauthenticated" || isAllowedRoute) {
      setReady(true)
      return
    }

    if (establecimientos.length === 0 && !redirectedRef.current) {
      redirectedRef.current = true
      router.push("/configuracion/onboarding")
      return
    }

    setReady(true)
  }, [status, isLoading, establecimientos.length, isAllowedRoute, router])

  // Resetear cuando cambia la ruta
  useEffect(() => {
    redirectedRef.current = false
  }, [pathname])

  if (!ready) {
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
