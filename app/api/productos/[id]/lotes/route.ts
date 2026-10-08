import { z } from "zod"
import { NextResponse } from "next/server"
import { crearLote, respuestaError } from "@/lib/inventario/service"
import { prisma } from "@/lib/prisma"
import { decimalToNumber } from "@/lib/api/serialize"
import { withAuth } from "@/lib/api/with-auth"
import { scopeCatalogo } from "@/lib/api/tenant"

export const GET = withAuth(async (request, ctx) => {
  try {
    const productoId = ctx.params.id

    const producto = await prisma.producto.findFirst({
      where: {
        id: productoId,
        ...scopeCatalogo(ctx.organizacionIds),
      },
    })

    if (!producto) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    const lotes = await prisma.loteProducto.findMany({
      where: { productoId },
      orderBy: { vencimiento: "asc" },
    })

    const data = lotes.map((lote) => ({
      ...lote,
      costo: decimalToNumber(lote.costo),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error al obtener lotes de producto:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request, ctx) => {
  try {
    const productoId = z.string().uuid().parse(ctx.params.id)
    const lote = await crearLote(ctx, productoId, await request.json())
    return NextResponse.json(
      { success: true, data: { ...lote, costo: decimalToNumber(lote.costo) } },
      { status: 201 }
    )
  } catch (error) {
    const r = respuestaError(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error al crear lote de producto:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
