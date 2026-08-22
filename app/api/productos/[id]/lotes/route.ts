import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { scopeOrganizacion } from "@/lib/api/tenant"

export const GET = withAuth(async (request, ctx) => {
  try {
    const productoId = ctx.params.id

    const producto = await prisma.producto.findFirst({
      where: {
        id: productoId,
        ...scopeOrganizacion(ctx.organizacionIds),
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

    return NextResponse.json({ success: true, data: lotes })
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
    const productoId = ctx.params.id
    const body = await request.json()

    const producto = await prisma.producto.findFirst({
      where: {
        id: productoId,
        ...scopeOrganizacion(ctx.organizacionIds),
      },
    })

    if (!producto) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    if (!body.nroLote) {
      return NextResponse.json(
        { error: "Se requiere el número de lote" },
        { status: 400 }
      )
    }

    const lote = await prisma.loteProducto.create({
      data: {
        productoId,
        nroLote: body.nroLote,
        vencimiento: body.vencimiento ? new Date(body.vencimiento) : null,
        proveedor: body.proveedor || null,
        cantidad: body.cantidad ? parseFloat(body.cantidad) : null,
        unidad: body.unidad || null,
        costo: body.costo ? parseFloat(body.costo) : null,
      },
    })

    return NextResponse.json(
      { success: true, data: lote },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error al crear lote de producto:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
