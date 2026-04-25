import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/api/audit-log"
import { z } from "zod"

const movimientoSchema = z.object({
  productoId: z.string().uuid("ID de producto inválido"),
  loteProductoId: z.string().uuid("ID de lote inválido").optional().nullable(),
  tipo: z.enum(["entrada", "salida", "ajuste"], {
    errorMap: () => ({ message: "Tipo debe ser 'entrada', 'salida' o 'ajuste'" }),
  }),
  cantidad: z
    .number({ invalid_type_error: "La cantidad debe ser un número" })
    .positive("La cantidad debe ser mayor a 0"),
  motivo: z.string().optional().nullable(),
  fecha: z.string().datetime().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const productoId = searchParams.get("productoId")
    const tipo = searchParams.get("tipo")
    const fechaDesde = searchParams.get("fechaDesde")
    const fechaHasta = searchParams.get("fechaHasta")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (productoId) {
      where.productoId = productoId
    }

    if (tipo) {
      where.tipo = tipo
    }

    if (fechaDesde || fechaHasta) {
      where.fecha = {}
      if (fechaDesde) {
        ;(where.fecha as Record<string, unknown>).gte = new Date(fechaDesde)
      }
      if (fechaHasta) {
        ;(where.fecha as Record<string, unknown>).lte = new Date(fechaHasta)
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
        cantidad: m.cantidad,
        motivo: m.motivo,
        fecha: m.fecha.toISOString(),
        createdAt: m.createdAt.toISOString(),
        producto: m.producto,
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
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = movimientoSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { productoId, loteProductoId, tipo, cantidad, motivo, fecha } =
      parsed.data

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    })

    if (!producto) {
      return NextResponse.json(
        { success: false, error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    if (loteProductoId) {
      const lote = await prisma.loteProducto.findUnique({
        where: { id: loteProductoId },
      })

      if (!lote || lote.productoId !== productoId) {
        return NextResponse.json(
          {
            success: false,
            error: "Lote de producto no encontrado o no pertenece al producto",
          },
          { status: 400 }
        )
      }
    }

    const movimiento = await prisma.movimientoStock.create({
      data: {
        productoId,
        loteProductoId: loteProductoId ?? null,
        tipo,
        cantidad,
        motivo: motivo ?? null,
        fecha: fecha ? new Date(fecha) : new Date(),
      },
      include: {
        producto: { select: { id: true, nombre: true, tipo: true } },
        loteProducto: {
          select: { id: true, nroLote: true, vencimiento: true },
        },
      },
    })

    await logAudit({
      userId: session.user.id,
      tabla: "movimientos_stock",
      rowPk: movimiento.id,
      accion: "INSERT",
      detalle: {
        productoId,
        productoNombre: producto.nombre,
        tipo,
        cantidad,
        motivo,
        loteProductoId,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: movimiento.id,
          tipo: movimiento.tipo,
          cantidad: movimiento.cantidad,
          motivo: movimiento.motivo,
          fecha: movimiento.fecha.toISOString(),
          createdAt: movimiento.createdAt.toISOString(),
          producto: movimiento.producto,
          loteProducto: movimiento.loteProducto
            ? {
                ...movimiento.loteProducto,
                vencimiento:
                  movimiento.loteProducto.vencimiento?.toISOString() ?? null,
              }
            : null,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error al crear movimiento de stock:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
