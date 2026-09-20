import { mapBody, mapResult, MapError } from "@/lib/mapa/api"
import { moveAnimals } from "@/lib/mapa/move"
import { NextResponse } from "next/server"
import { animalDelTenant, loteDelTenant, scopeEventoAnimalOLote } from "@/lib/api/tenant"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const sectorId = searchParams.get("sectorId")
    const establecimientoId = searchParams.get("establecimientoId")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    const condiciones: Record<string, unknown>[] = [
      scopeEventoAnimalOLote(ctx.establecimientoIds),
    ]
    const where: Record<string, unknown> = { AND: condiciones }

    if (sectorId) {
      condiciones.push({
        OR: [
          { origenSectorId: sectorId },
          { destinoSectorId: sectorId },
        ],
      })
    }

    if (establecimientoId) {
      where.destinoSector = { establecimientoId }
    }

    if (desde || hasta) {
      where.fecha = {}
      if (desde) (where.fecha as Record<string, unknown>).gte = new Date(desde)
      if (hasta) (where.fecha as Record<string, unknown>).lte = new Date(hasta)
    }

    const [movimientos, total] = await Promise.all([
      prisma.evtMovimiento.findMany({
        where: where as any,
        include: {
          animal: {
            select: {
              id: true,
              caravanaVisual: true,
              otroId: true,
              cuig: true,
            },
          },
          lote: {
            select: { id: true, nombre: true },
          },
          origenSector: {
            select: { id: true, nombre: true, tipo: true },
          },
          destinoSector: {
            select: { id: true, nombre: true, tipo: true },
          },
        },
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      prisma.evtMovimiento.count({ where: where as any }),
    ])

    return NextResponse.json({
      success: true,
      data: movimientos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error al obtener movimientos:", error)
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
