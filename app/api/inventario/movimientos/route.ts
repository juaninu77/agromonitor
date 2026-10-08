import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { parsePagination } from "@/lib/api/pagination"
import { filtroUbicacion } from "@/lib/inventario/ubicacion"
import { registrarMovimientoStock, respuestaError } from "@/lib/inventario/service"

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const productoId = searchParams.get("productoId")
    const tipo = searchParams.get("tipo")
    const fechaDesde = searchParams.get("fechaDesde")
    const fechaHasta = searchParams.get("fechaHasta")
    const pagination = parsePagination(searchParams)
    if (!pagination.success) {
      return NextResponse.json({ error: "Paginación inválida" }, { status: 400 })
    }
    const { page, limit } = pagination.data
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      producto: { organizacionId: { in: ctx.organizacionIds } },
    }

    if (productoId) {
      where.productoId = productoId
    }

    if (tipo) {
      where.tipo = tipo
    }

    const ubicacion = filtroUbicacion(searchParams.get("ubicacion"), ctx.establecimientoIds)
    if (ubicacion) Object.assign(where, ubicacion)

    // Rango de días en hora de Argentina (AAAA-MM-DD), ambos inclusive
    const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    if ((fechaDesde && !dia.safeParse(fechaDesde).success) || (fechaHasta && !dia.safeParse(fechaHasta).success)) {
      return NextResponse.json({ success: false, error: "Fechas inválidas (AAAA-MM-DD)" }, { status: 400 })
    }
    if (fechaDesde || fechaHasta) {
      where.fecha = {
        ...(fechaDesde ? { gte: new Date(`${fechaDesde}T00:00:00-03:00`) } : {}),
        ...(fechaHasta ? { lt: new Date(new Date(`${fechaHasta}T00:00:00-03:00`).getTime() + 86_400_000) } : {}),
      }
    }

    const [movimientos, total] = await Promise.all([
      prisma.movimientoStock.findMany({
        where: where as any,
        include: {
          producto: {
            select: { id: true, nombre: true, tipo: true },
          },
          loteProducto: {
            select: { id: true, nroLote: true, vencimiento: true },
          },
          sector: { select: { id: true, nombre: true } },
        },
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      prisma.movimientoStock.count({ where: where as any }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: movimientos.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        cantidad: Number(m.cantidad),
        operacionId: m.operacionId,
        motivo: m.motivo,
        fecha: m.fecha.toISOString(),
        createdAt: m.createdAt.toISOString(),
        producto: m.producto,
        ubicacion: m.sector,
        loteProducto: m.loteProducto
          ? {
              ...m.loteProducto,
              vencimiento: m.loteProducto.vencimiento?.toISOString() ?? null,
            }
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    console.error("Error al obtener movimientos de stock:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request, ctx) => {
  try {
    const { movimiento, repetido } = await registrarMovimientoStock(ctx, await request.json())
    return NextResponse.json(
      {
        success: true,
        data: {
          id: movimiento.id,
          tipo: movimiento.tipo,
          cantidad: Number(movimiento.cantidad),
          motivo: movimiento.motivo,
          fecha: movimiento.fecha.toISOString(),
          createdAt: movimiento.createdAt.toISOString(),
        },
      },
      { status: repetido ? 200 : 201 }
    )
  } catch (error) {
    const r = respuestaError(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error al crear movimiento de stock:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
