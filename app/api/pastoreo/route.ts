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

export const POST = withAuth(async (request, ctx) => {
  try {
    const body = await request.json()

    if (!body.loteId || !body.sectorId) {
      return NextResponse.json(
        { error: "Se requieren loteId y sectorId" },
        { status: 400 }
      )
    }

    const [lote, sector] = await Promise.all([
      loteDelTenant(body.loteId, ctx.establecimientoIds),
      sectorDelTenant(body.sectorId, ctx.establecimientoIds),
    ])

    if (!lote) {
      return NextResponse.json(
        { error: "Lote no encontrado" },
        { status: 404 }
      )
    }

    if (!sector) {
      return NextResponse.json(
        { error: "Sector no encontrado" },
        { status: 404 }
      )
    }

    const pastoreo = await prisma.evtPastoreo.create({
      data: {
        ingreso: body.ingreso ? new Date(body.ingreso) : new Date(),
        egreso: body.egreso ? new Date(body.egreso) : null,
        animalesPromedio: body.animalesPromedio
          ? parseInt(body.animalesPromedio)
          : null,
        observ: body.observ || null,
        loteId: body.loteId,
        sectorId: body.sectorId,
      },
      include: {
        lote: { select: { id: true, nombre: true } },
        sector: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(
      { success: true, data: pastoreo },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error al crear pastoreo:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
