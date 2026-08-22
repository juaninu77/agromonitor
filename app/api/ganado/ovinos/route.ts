import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { scopeEstablecimiento } from "@/lib/api/tenant"
import { prisma } from "@/lib/prisma"

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const establecimientoId = searchParams.get("establecimientoId")

    // Scoping multi-tenant: si el cliente pide un establecimiento, debe ser accesible
    if (establecimientoId && !ctx.establecimientoIds.includes(establecimientoId)) {
      return NextResponse.json(
        { error: "No tienes acceso a este establecimiento" },
        { status: 403 }
      )
    }
    const establecimientosPermitidos = establecimientoId
      ? [establecimientoId]
      : ctx.establecimientoIds

    const especieOvina = await prisma.especie.findFirst({
      where: { nombre: { contains: "ovin", mode: "insensitive" } },
    })

    if (!especieOvina) {
      return NextResponse.json({
        success: true,
        data: [],
        stats: { total: 0, pesoPromedio: 0 },
      })
    }

    const where: any = {
      especieId: especieOvina.id,
      estadoVital: "activo",
      ...scopeEstablecimiento(establecimientosPermitidos),
    }

    const ovinos = await prisma.animal.findMany({
      where,
      include: {
        raza: true,
        categoria: true,
      },
      orderBy: { caravanaVisual: "asc" },
    })

    return NextResponse.json({
      success: true,
      data: ovinos,
      stats: {
        total: ovinos.length,
      },
    })
  } catch (error) {
    console.error("Error al obtener ovinos:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
