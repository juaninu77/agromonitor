import { NextResponse } from "next/server"
import { crearProducto, respuestaError } from "@/lib/inventario/service"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { scopeCatalogo } from "@/lib/api/tenant"
import { decimalToNumber } from "@/lib/api/serialize"

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const tipo = searchParams.get("tipo")
    const busqueda = searchParams.get("busqueda")

    const where: Record<string, unknown> = {
      ...scopeCatalogo(ctx.organizacionIds),
      // Los archivados no se ofrecen para nuevas aplicaciones
      ...(searchParams.get("archivados") === "1" ? {} : { activo: true }),
    }

    if (tipo) {
      where.tipo = tipo
    }

    if (busqueda) {
      where.AND = [
        {
          OR: [
            { nombre: { contains: busqueda, mode: "insensitive" } },
            { principioActivo: { contains: busqueda, mode: "insensitive" } },
            { laboratorio: { contains: busqueda, mode: "insensitive" } },
          ],
        },
      ]
    }

    const productos = await prisma.producto.findMany({
      where: where as any,
      include: {
        lotes: {
          orderBy: { vencimiento: "asc" },
        },
        _count: {
          select: { eventosSanidad: true },
        },
      },
      orderBy: { nombre: "asc" },
    })

    const data = productos.map((producto) => ({
      ...producto,
      lotes: producto.lotes.map((lote) => ({
        ...lote,
        cantidad: decimalToNumber(lote.cantidad),
        costo: decimalToNumber(lote.costo),
      })),
      stockMinimo: decimalToNumber(producto.stockMinimo),
      costoReferencia: decimalToNumber(producto.costoReferencia),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error al obtener productos:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request, ctx) => {
  try {
    const producto = await crearProducto(ctx, await request.json())
    return NextResponse.json({ success: true, data: producto }, { status: 201 })
  } catch (error) {
    const r = respuestaError(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error al crear producto:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
