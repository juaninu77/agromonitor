import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"

export const GET = withAuth(
  async (request, ctx) => {
    try {
      // AuditLog es global (sin columna de tenant): solo admin de plataforma.
      // Un rol "admin" derivado de una Membresia NO habilita ver el log global.
      if (!ctx.esAdminPlataforma) {
        return NextResponse.json(
          { error: "No tienes permisos para esta accion" },
          { status: 403 }
        )
      }

      const searchParams = request.nextUrl.searchParams
      const tabla = searchParams.get("tabla")
      const accion = searchParams.get("accion")
      const busqueda = searchParams.get("busqueda")
      const page = parseInt(searchParams.get("page") || "1")
      const limit = parseInt(searchParams.get("limit") || "50")

      const where: Record<string, unknown> = {}
      if (tabla) where.tabla = tabla
      if (accion) where.accion = accion
      if (busqueda) {
        where.OR = [
          { tabla: { contains: busqueda, mode: "insensitive" } },
          { rowPk: { contains: busqueda, mode: "insensitive" } },
        ]
      }

      const [entries, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: where as any,
          include: {
            usuario: { select: { nombre: true, apellido: true, email: true } },
          },
          orderBy: { fecha: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.auditLog.count({ where: where as any }),
      ])

      return NextResponse.json({
        success: true,
        data: entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      console.error("Error en audit API:", error)
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      )
    }
  }
)
