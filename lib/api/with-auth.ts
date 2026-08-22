import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

type AppRole = "admin" | "encargado" | "vet" | "operario"

// Jerarquía: admin > encargado > vet > operario
const JERARQUIA_ROLES: Record<AppRole, number> = {
  admin: 4,
  encargado: 3,
  vet: 2,
  operario: 1,
}

interface AuthOptions {
  roles?: AppRole[]
}

export interface AuthContext {
  userId: string
  userRole: AppRole
  /** Establecimientos accesibles vía Membresias activas — filtrar SIEMPRE por esto */
  establecimientoIds: string[]
  /** Organizaciones accesibles vía Membresias activas */
  organizacionIds: string[]
  /** Params de rutas dinámicas ([id], etc.), ya resueltos */
  params: Record<string, string>
}

type AuthHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse> | Promise<Response>

function esRolValido(rol: string | undefined | null): rol is AppRole {
  return rol === "admin" || rol === "encargado" || rol === "vet" || rol === "operario"
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

      // El rol por organización (Membresia) es la fuente de verdad;
      // Usuario.rol (sesión) queda como respaldo para cuentas sin membresía.
      const rolesMembresia = membresias
        .map((m) => m.rol)
        .filter(esRolValido)
      const rolSesion = esRolValido(session.user.rol) ? session.user.rol : "operario"
      const userRole = rolesMembresia.reduce<AppRole>(
        (max, rol) => (JERARQUIA_ROLES[rol] > JERARQUIA_ROLES[max] ? rol : max),
        rolesMembresia.length > 0 ? rolesMembresia[0] : rolSesion
      )

      if (options.roles && !options.roles.includes(userRole)) {
        return NextResponse.json(
          { error: "No tienes permisos para esta accion" },
          { status: 403 }
        )
      }

      const params = routeContext?.params ? await routeContext.params : {}

      return handler(request, {
        userId: session.user.id,
        userRole,
        establecimientoIds,
        organizacionIds,
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
