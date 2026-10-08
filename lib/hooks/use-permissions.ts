"use client"

import { useSession } from "next-auth/react"
import { useTenant } from "@/lib/context/tenant-context"
import { useMemo } from "react"

type AppRole = "admin" | "encargado" | "vet" | "operario"
type OrgRole = "propietario" | "admin" | "encargado" | "vet" | "operario"

interface Permissions {
  /** Rol efectivo en la organización activa (propietario cuenta como admin). */
  role: AppRole
  /** Rol tal como figura en la membresía de la organización activa. */
  orgRole: OrgRole | null
  isAdmin: boolean
  isOwner: boolean
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

const ORG_ROLES: OrgRole[] = ["propietario", "admin", "encargado", "vet", "operario"]

/**
 * Permisos de la interfaz según el rol en la ORGANIZACIÓN ACTIVA (los roles son por
 * organización). El servidor vuelve a verificar todo: esto solo decide qué mostrar.
 */
export function usePermissions(): Permissions {
  const { data: session } = useSession()
  const { organizacionActiva } = useTenant()

  return useMemo(() => {
    const raw = organizacionActiva?.rol === "administrador" ? "admin" : organizacionActiva?.rol
    const orgRole: OrgRole | null = ORG_ROLES.includes(raw as OrgRole) ? (raw as OrgRole) : null
    const role: AppRole = orgRole === "propietario" ? "admin" : (orgRole as AppRole | null) ?? "operario"

    const isAdmin = role === "admin"
    const isManager = role === "admin" || role === "encargado"
    const isVet = role === "vet"

    return {
      role,
      orgRole,
      isAdmin,
      isOwner: orgRole === "propietario",
      isManager,
      isVet,
      canManageUsers: isAdmin,
      canManageConfig: isManager,
      canWriteData: true,
      canDeleteData: isManager,
      canViewFinances: isManager,
      // La auditoría global es solo del admin de plataforma (rol de la cuenta, no de la org)
      canViewAuditLog: session?.user?.rol === "admin",
      hasRole: (...roles: AppRole[]) => roles.includes(role),
      hasOrgRole: (...roles: OrgRole[]) => orgRole !== null && roles.includes(orgRole),
    }
  }, [session?.user?.rol, organizacionActiva])
}
