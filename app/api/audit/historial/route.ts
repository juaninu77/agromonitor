import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"

// GET /api/audit/historial?tabla=Animal&rowPk=<id>
// Devuelve la línea de tiempo de cambios de un registro concreto:
// quién, cuándo, qué acción y qué campos cambiaron (de → a).
export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const tabla = searchParams.get("tabla")
    const rowPk = searchParams.get("rowPk")

    if (!tabla || !rowPk) {
      return NextResponse.json(
        { error: "Se requieren los parámetros 'tabla' y 'rowPk'" },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = { tabla, rowPk }

    // Scoping: el admin de plataforma ve todo; el resto solo su(s) organización(es).
    if (!ctx.esAdminPlataforma) {
      where.organizacionId = { in: ctx.organizacionIds }
    }

    const entradas = await prisma.auditLog.findMany({
      where: where as any,
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true, email: true } },
      },
      orderBy: { fecha: "desc" },
      take: 200,
    })

    return NextResponse.json({ success: true, data: entradas })
  } catch (error) {
    console.error("Error al obtener historial de auditoría:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
