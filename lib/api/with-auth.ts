import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

type AppRole = "admin" | "encargado" | "vet" | "operario"

interface AuthOptions {
  /**
   * Gate grueso: el usuario debe tener alguno de estos roles en AL MENOS UNA
   * organización (o ser admin de plataforma). NO alcanza como frontera de
   * seguridad por sí solo: para acciones sobre un recurso concreto, resolvé el
   * rol EN LA ORG DUEÑA del recurso con `establecimientoIdsConRol` /
   * `organizacionIdsConRol` / `rolPorEstablecimiento`.
   */
  roles?: AppRole[]
}

export interface AuthContext {
  userId: string
  /**
   * Rol efectivo de referencia (máximo entre las Membresias). Útil para UI,
   * pero NO decide permisos por recurso: el rol es por organización.
   */
  userRole: AppRole
  /** true solo si Usuario.rol === "admin" (admin de plataforma, no de una org). */
  esAdminPlataforma: boolean
  /** Establecimientos accesibles vía Membresias activas — filtrar SIEMPRE por esto */
  establecimientoIds: string[]
  /** Organizaciones accesibles vía Membresias activas */
  organizacionIds: string[]
  /** Rol del usuario en cada establecimiento (según la Membresia de su org). */
  rolPorEstablecimiento: Record<string, AppRole>
  /** Rol del usuario en cada organización. */
  rolPorOrganizacion: Record<string, AppRole>
  /** Organización dueña de cada establecimiento accesible. */
  organizacionDeEstablecimiento: Record<string, string>
  /** Subconjunto de establecimientoIds donde el usuario tiene uno de esos roles. */
  establecimientoIdsConRol: (roles: AppRole[]) => string[]
  /** Subconjunto de organizacionIds donde el usuario tiene uno de esos roles. */
  organizacionIdsConRol: (roles: AppRole[]) => string[]
  /** Params de rutas dinámicas ([id], etc.), ya resueltos */
  params: Record<string, string>
}

type AuthHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse> | Promise<Response>

// Jerarquía: admin > encargado > vet > operario
const JERARQUIA_ROLES: Record<AppRole, number> = {
  admin: 4,
  encargado: 3,
  vet: 2,
  operario: 1,
}

// Las Membresias históricas usan también "propietario"/"administrador":
// se normalizan a "admin" para el chequeo de permisos DENTRO de esa organización.
function normalizarRol(rol: string | undefined | null): AppRole | null {
  if (rol === "propietario" || rol === "administrador" || rol === "admin") return "admin"
  if (rol === "encargado" || rol === "vet" || rol === "operario") return rol
  return null
}

export function withAuth(handler: AuthHandler, options: AuthOptions = {}) {
  return async (
    request: NextRequest,
    routeContext?: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const session = await auth()

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "No autenticado" },
          { status: 401 }
        )
      }

      const membresias = await prisma.membresia.findMany({
        where: { usuarioId: session.user.id, esActivo: true },
        include: {
          organizacion: {
            include: { establecimientos: { select: { id: true } } },
          },
        },
      })

      const organizacionIds = membresias.map((m) => m.organizacionId)
      const establecimientoIds = membresias.flatMap((m) =>
        m.organizacion.establecimientos.map((e) => e.id)
      )

      // Rol POR organización/establecimiento (fuente de verdad multi-tenant):
      // nunca se colapsa a un rol global entre orgs, para que un rol alto en
      // una org no otorgue permisos en otra donde el usuario es operario.
      const rolPorOrganizacion: Record<string, AppRole> = {}
      const rolPorEstablecimiento: Record<string, AppRole> = {}
      const organizacionDeEstablecimiento: Record<string, string> = {}
      for (const m of membresias) {
        const rol = normalizarRol(m.rol) ?? "operario"
        rolPorOrganizacion[m.organizacionId] = rol
        for (const e of m.organizacion.establecimientos) {
          rolPorEstablecimiento[e.id] = rol
          organizacionDeEstablecimiento[e.id] = m.organizacionId
        }
      }

      const establecimientoIdsConRol = (roles: AppRole[]) =>
        establecimientoIds.filter((id) => roles.includes(rolPorEstablecimiento[id]))
      const organizacionIdsConRol = (roles: AppRole[]) =>
        organizacionIds.filter((id) => roles.includes(rolPorOrganizacion[id]))

      // Admin de plataforma: SOLO el rol global del Usuario, nunca derivado de
      // una Membresia (crear una org no debe volver admin de plataforma).
      const esAdminPlataforma = session.user.rol === "admin"

      // userRole de referencia (máximo entre orgs) — para UI/fallback, no gating por recurso.
      const rolesMembresia = Object.values(rolPorOrganizacion)
      const rolSesion = normalizarRol(session.user.rol) ?? "operario"
      const userRole = rolesMembresia.reduce<AppRole>(
        (max, rol) => (JERARQUIA_ROLES[rol] > JERARQUIA_ROLES[max] ? rol : max),
        rolesMembresia.length > 0 ? rolesMembresia[0] : rolSesion
      )

      // Gate grueso: al menos una org con el rol requerido (o admin de plataforma).
      if (options.roles) {
        const cumpleEnAlgunaOrg =
          esAdminPlataforma ||
          organizacionIdsConRol(options.roles).length > 0
        if (!cumpleEnAlgunaOrg) {
          return NextResponse.json(
            { error: "No tienes permisos para esta accion" },
            { status: 403 }
          )
        }
      }

      const params = routeContext?.params ? await routeContext.params : {}

      return handler(request, {
        userId: session.user.id,
        userRole,
        esAdminPlataforma,
        establecimientoIds,
        organizacionIds,
        rolPorEstablecimiento,
        rolPorOrganizacion,
        organizacionDeEstablecimiento,
        establecimientoIdsConRol,
        organizacionIdsConRol,
        params,
      })
    } catch (error) {
      console.error("Error en withAuth:", error)
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      )
    }
  }
}
