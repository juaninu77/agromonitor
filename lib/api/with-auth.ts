import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

type AppRole = "admin" | "encargado" | "vet" | "operario"

interface AuthOptions {
  roles?: AppRole[]
}

interface AuthContext {
  userId: string
  userRole: AppRole
  establecimientoIds: string[]
}

type AuthHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse>

export function withAuth(handler: AuthHandler, options: AuthOptions = {}) {
  return async (request: NextRequest) => {
    try {
      const session = await auth()

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "No autenticado" },
          { status: 401 }
        )
      }

      const userRole = (session.user.rol as AppRole) || "operario"

      if (options.roles && !options.roles.includes(userRole)) {
        return NextResponse.json(
          { error: "No tienes permisos para esta accion" },
          { status: 403 }
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

      const establecimientoIds = membresias.flatMap((m) =>
        m.organizacion.establecimientos.map((e) => e.id)
      )

      return handler(request, {
        userId: session.user.id,
        userRole,
        establecimientoIds,
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
