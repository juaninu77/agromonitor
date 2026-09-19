import { mapBody, mapResult, MapError } from "@/lib/mapa/api"
import { moveAnimals } from "@/lib/mapa/move"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { loteDelTenant, sectorDelTenant } from "@/lib/api/tenant"

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const establecimientoId = searchParams.get("establecimientoId")
    const sectorId = searchParams.get("sectorId")
    const activos = searchParams.get("activos")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    if (establecimientoId && !ctx.establecimientoIds.includes(establecimientoId)) {
      return NextResponse.json(
        { error: "No tienes acceso a ese establecimiento" },
        { status: 403 }
      )
    }

    const where: Record<string, unknown> = {
      lote: { establecimientoId: { in: ctx.establecimientoIds } },
    }

    if (establecimientoId) {
      where.sector = { establecimientoId }
    }

    if (sectorId) {
      where.sectorId = sectorId
    }

    if (activos === "true") {
      where.egreso = null
    }

    const [pastoreos, total] = await Promise.all([
      prisma.evtPastoreo.findMany({
        where: where as any,
        include: {
          lote: { select: { id: true, nombre: true, tipo: true } },
          sector: { select: { id: true, nombre: true, tipo: true } },
        },
        orderBy: { ingreso: "desc" },
        skip,
        take: limit,
      }),
      prisma.evtPastoreo.count({ where: where as any }),
    ])

    return NextResponse.json({
      success: true,
      data: pastoreos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error al obtener pastoreos:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request, ctx) => mapResult(async () => {
  const raw = await mapBody(request)
  if (raw.egreso || raw.fecha || raw.ingreso) {
    const date = new Date(raw.fecha ?? raw.ingreso)
    if (raw.egreso || !Number.isFinite(date.getTime()) || Math.abs(date.getTime() - Date.now()) > 300000) throw new MapError("Registrá movimientos actuales; los cambios históricos requieren revisar las ubicaciones")
  }
  const data = await moveAnimals({ ...raw, destinoSectorId: raw.destinoSectorId ?? raw.sectorId, ...(raw.animalId ? { animalIds: [raw.animalId] } : {}) }, ctx)
  return NextResponse.json({ success: true, data }, { status: 201 })
}))
