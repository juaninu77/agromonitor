import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const sectorId = searchParams.get("sectorId")
    const establecimientoId = searchParams.get("establecimientoId")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (sectorId) {
      where.OR = [
        { origenSectorId: sectorId },
        { destinoSectorId: sectorId },
      ]
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
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await request.json()

    if (!body.destinoSectorId) {
      return NextResponse.json(
        { error: "Se requiere sector destino" },
        { status: 400 }
      )
    }

    if (!body.animalId && !body.loteId) {
      return NextResponse.json(
        { error: "Se requiere animal o lote" },
        { status: 400 }
      )
    }

    const movimiento = await prisma.evtMovimiento.create({
      data: {
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        motivo: body.motivo || null,
        observ: body.observ || null,
        animalId: body.animalId || null,
        loteId: body.loteId || null,
        cantidadAnimales: body.cantidadAnimales
          ? parseInt(body.cantidadAnimales)
          : null,
        origenSectorId: body.origenSectorId || null,
        destinoSectorId: body.destinoSectorId,
      },
      include: {
        animal: {
          select: {
            id: true,
            caravanaVisual: true,
            otroId: true,
          },
        },
        lote: { select: { id: true, nombre: true } },
        origenSector: { select: { id: true, nombre: true } },
        destinoSector: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(
      { success: true, data: movimiento },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error al crear movimiento:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
