import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { descontarAplicacion } from "@/lib/inventario/aplicaciones"
import { InventarioError } from "@/lib/inventario/service"
import { prisma } from "@/lib/prisma"
import { decimalToNumber } from "@/lib/api/serialize"
import { withAuth } from "@/lib/api/with-auth"
import {
  animalDelTenant,
  loteDelTenant,
  scopeEventoAnimalOLote,
} from "@/lib/api/tenant"

export const GET = withAuth(async (request, { establecimientoIds }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const loteId = searchParams.get("loteId")
    const animalId = searchParams.get("animalId")
    const productoId = searchParams.get("productoId")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      ...scopeEventoAnimalOLote(establecimientoIds),
    }

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

    const data = eventos.map((evento) => ({
      ...evento,
      costo: decimalToNumber(evento.costo),
    }))

    return NextResponse.json({
      success: true,
      data,
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
})

export const POST = withAuth(async (request, { establecimientoIds, organizacionIds, organizacionDeEstablecimiento }) => {
  try {
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

    if (body.animalId && body.loteId) {
      return NextResponse.json({ error: "Indicá un animal o un grupo, no ambos" }, { status: 400 })
    }

    const producto = await prisma.producto.findFirst({
      where: {
        id: body.productoId,
        organizacionId: { in: organizacionIds },
      },
    })

    if (!producto) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    // El producto tiene que ser de la misma organización que el animal o el grupo (su stock es el que se descuenta)
    const mismaOrg = (establecimientoId: string | null) => !establecimientoId || organizacionDeEstablecimiento[establecimientoId] === producto.organizacionId

    if (body.animalId) {
      const animal = await animalDelTenant(body.animalId, establecimientoIds)
      if (animal && !mismaOrg(animal.establecimientoId)) {
        return NextResponse.json({ error: "El producto es de otra organización que el animal" }, { status: 400 })
      }
      if (!animal) {
        return NextResponse.json(
          { error: "Animal no encontrado" },
          { status: 404 }
        )
      }
    }

    if (body.loteId) {
      const lote = await loteDelTenant(body.loteId, establecimientoIds)
      if (lote && !mismaOrg(lote.establecimientoId)) {
        return NextResponse.json({ error: "El producto es de otra organización que el grupo" }, { status: 400 })
      }
      if (!lote) {
        return NextResponse.json(
          { error: "Lote no encontrado" },
          { status: 404 }
        )
      }
    }

    if (body.loteProductoId) {
      const loteProducto = await prisma.loteProducto.findFirst({
        where: { id: body.loteProductoId, productoId: body.productoId },
      })
      if (!loteProducto) {
        return NextResponse.json(
          { error: "Lote de producto no encontrado" },
          { status: 404 }
        )
      }
    }

    // Descuento de stock (opcional): cantidad en la unidad del producto, en la misma transacción
    const descuento = body.descontarStock == null || body.descontarStock === "" ? null : Number(body.descontarStock)
    if (descuento != null && !(Number.isFinite(descuento) && descuento > 0 && descuento <= 10_000_000)) {
      return NextResponse.json({ error: "La cantidad a descontar del stock no es válida" }, { status: 400 })
    }
    if (descuento != null && !producto.activo) {
      return NextResponse.json({ error: "El producto está archivado: no se puede descontar stock" }, { status: 400 })
    }
    const sectorStock = body.sectorStockId === undefined ? undefined : body.sectorStockId || null

    const { evento, stock } = await prisma.$transaction(async (tx) => {
      const evento = await tx.evtSanidad.create({
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
      const stock = descuento == null ? null : await descontarAplicacion(tx, {
        productoId: body.productoId, cantidad: descuento, loteProductoId: body.loteProductoId || null, sectorId: sectorStock,
        fecha: new Date(`${String(body.fecha).slice(0, 10)}T12:00:00-03:00`),
        motivo: `Aplicación sanitaria · ${evento.animal?.caravanaVisual ?? (evento.lote ? `grupo ${evento.lote.nombre}` : "")}`.trim(),
        origenTipo: "sanidad", origenId: evento.id,
      }, { establecimientoIds, estricto: true, aceptarVencido: body.aceptarVencido === true })
      return { evento, stock }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })

    return NextResponse.json(
      { success: true, data: { ...evento, costo: decimalToNumber(evento.costo), stock } },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof InventarioError) return NextResponse.json({ error: error.message, codigo: error.codigo ?? "stock" }, { status: error.status })
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Otro movimiento se registró al mismo tiempo. Reintentá." }, { status: 409 })
    console.error("Error al crear evento sanitario:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
