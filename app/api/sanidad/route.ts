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
    const loteId = searchParams.get("loteId")
    const animalId = searchParams.get("animalId")
    const productoId = searchParams.get("productoId")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (loteId) {
      where.loteId = loteId
    }

    if (animalId) {
      where.animalId = animalId
    }

    if (productoId) {
      where.productoId = productoId
    }

    if (desde || hasta) {
      where.fecha = {}
      if (desde) {
        ;(where.fecha as Record<string, unknown>).gte = new Date(desde)
      }
      if (hasta) {
        ;(where.fecha as Record<string, unknown>).lte = new Date(hasta)
      }
    }

    const [eventos, total] = await Promise.all([
      prisma.evtSanidad.findMany({
        where: where as any,
        include: {
          animal: {
            select: {
              id: true,
              caravanaVisual: true,
              cuig: true,
              otroId: true,
              sexo: true,
              categoria: { select: { nombre: true } },
            },
          },
          producto: true,
          loteProducto: true,
          lote: {
            select: { id: true, nombre: true },
          },
        },
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      prisma.evtSanidad.count({ where: where as any }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: eventos,
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
    console.error("Error al obtener eventos sanitarios:", error)
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

    if (!body.productoId) {
      return NextResponse.json(
        { error: "Se requiere un producto" },
        { status: 400 }
      )
    }

    if (!body.fecha) {
      return NextResponse.json(
        { error: "Se requiere una fecha" },
        { status: 400 }
      )
    }

    if (!body.animalId && !body.loteId) {
      return NextResponse.json(
        { error: "Se requiere un animal o un lote" },
        { status: 400 }
      )
    }

    const producto = await prisma.producto.findUnique({
      where: { id: body.productoId },
    })

    if (!producto) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    if (body.animalId) {
      const animal = await prisma.animal.findUnique({
        where: { id: body.animalId },
      })
      if (!animal) {
        return NextResponse.json(
          { error: "Animal no encontrado" },
          { status: 404 }
        )
      }
    }

    if (body.loteId) {
      const lote = await prisma.lote.findUnique({
        where: { id: body.loteId },
      })
      if (!lote) {
        return NextResponse.json(
          { error: "Lote no encontrado" },
          { status: 404 }
        )
      }
    }

    if (body.loteProductoId) {
      const loteProducto = await prisma.loteProducto.findUnique({
        where: { id: body.loteProductoId },
      })
      if (!loteProducto) {
        return NextResponse.json(
          { error: "Lote de producto no encontrado" },
          { status: 404 }
        )
      }
    }

    const evento = await prisma.evtSanidad.create({
      data: {
        fecha: new Date(body.fecha),
        dosis: body.dosis ? parseFloat(body.dosis) : null,
        unidad: body.unidad || null,
        via: body.via || null,
        motivo: body.motivo || null,
        carenciaDias: body.carenciaDias ? parseInt(body.carenciaDias) : null,
        aplicador: body.aplicador || null,
        veterinario: body.veterinario || null,
        costo: body.costo ? parseFloat(body.costo) : null,
        observ: body.observ || null,
        animalId: body.animalId || null,
        loteId: body.loteId || null,
        cantidadAnimales: body.cantidadAnimales
          ? parseInt(body.cantidadAnimales)
          : null,
        productoId: body.productoId,
        loteProductoId: body.loteProductoId || null,
      },
      include: {
        animal: {
          select: {
            id: true,
            caravanaVisual: true,
            cuig: true,
          },
        },
        producto: true,
        lote: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(
      { success: true, data: evento },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error al crear evento sanitario:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
