"use client"

import { usePermissions } from "@/lib/hooks/use-permissions"
import type { ReactNode } from "react"

type AppRole = "admin" | "encargado" | "vet" | "operario"

interface GateProps {
  children: ReactNode
  roles?: AppRole[]
  permission?: keyof Pick<
    ReturnType<typeof usePermissions>,
    | "canManageUsers"
    | "canManageConfig"
    | "canWriteData"
    | "canDeleteData"
    | "canViewFinances"
    | "canViewAuditLog"
  >
  fallback?: ReactNode
}

export function Gate({ children, roles, permission, fallback = null }: GateProps) {
  const permissions = usePermissions()

  if (roles && !permissions.hasRole(...roles)) {
    return <>{fallback}</>
  }

  if (permission && !permissions[permission]) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
