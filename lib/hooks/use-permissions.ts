"use client"

import { useSession } from "next-auth/react"
import { useTenant } from "@/lib/context/tenant-context"
import { useMemo } from "react"

type AppRole = "admin" | "encargado" | "vet" | "operario"
type OrgRole = "propietario" | "administrador" | "encargado" | "operario"

interface Permissions {
  role: AppRole
  orgRole: OrgRole | null
  isAdmin: boolean
  isManager: boolean
  isVet: boolean
  canManageUsers: boolean
  canManageConfig: boolean
  canWriteData: boolean
  canDeleteData: boolean
  canViewFinances: boolean
  canViewAuditLog: boolean
  hasRole: (...roles: AppRole[]) => boolean
  hasOrgRole: (...roles: OrgRole[]) => boolean
}

export function usePermissions(): Permissions {
  const { data: session } = useSession()
  const { organizacionActiva } = useTenant()

  return useMemo(() => {
    const role = (session?.user?.rol as AppRole) || "operario"
    const orgRole: OrgRole | null = null

    const isAdmin = role === "admin"
    const isManager = role === "admin" || role === "encargado"
    const isVet = role === "vet"

    return {
      role,
      orgRole,
      isAdmin,
      isManager,
      isVet,
      canManageUsers: isAdmin,
      canManageConfig: isManager,
      canWriteData: role !== "operario" || true,
      canDeleteData: isManager,
      canViewFinances: isManager,
      canViewAuditLog: isAdmin,
      hasRole: (...roles: AppRole[]) => roles.includes(role),
      hasOrgRole: (...roles: OrgRole[]) => orgRole !== null && roles.includes(orgRole),
    }
  }, [session?.user?.rol, organizacionActiva])
}
