import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { scopeOrganizacion } from "@/lib/api/tenant"
import { decimalToNumber } from "@/lib/api/serialize"

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const tipo = searchParams.get("tipo")
    const busqueda = searchParams.get("busqueda")

    const where: Record<string, unknown> = {
      ...scopeOrganizacion(ctx.organizacionIds),
    }

    if (tipo) {
      where.tipo = tipo
    }

    if (busqueda) {
      where.OR = [
        { nombre: { contains: busqueda, mode: "insensitive" } },
        { principioActivo: { contains: busqueda, mode: "insensitive" } },
        { laboratorio: { contains: busqueda, mode: "insensitive" } },
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
        costo: decimalToNumber(lote.costo),
      })),
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
    const body = await request.json()

    if (!body.nombre || !body.tipo) {
      return NextResponse.json(
        { error: "Se requiere nombre y tipo de producto" },
        { status: 400 }
      )
    }

    const tiposValidos = [
      "vacuna",
      "antiparasitario",
      "antibiotico",
      "mineral",
      "vitaminico",
      "otro",
    ]

    if (!tiposValidos.includes(body.tipo)) {
      return NextResponse.json(
        { error: `Tipo inválido. Debe ser uno de: ${tiposValidos.join(", ")}` },
        { status: 400 }
      )
    }

    let organizacionId: string
    if (body.organizacionId) {
      if (!ctx.organizacionIds.includes(body.organizacionId)) {
        return NextResponse.json(
          { error: "No tienes acceso a esa organización" },
          { status: 403 }
        )
      }
      organizacionId = body.organizacionId
    } else if (ctx.organizacionIds.length === 1) {
      organizacionId = ctx.organizacionIds[0]
    } else {
      return NextResponse.json(
        { error: "Se requiere organizacionId" },
        { status: 400 }
      )
    }

    const producto = await prisma.producto.create({
      data: {
        nombre: body.nombre,
        tipo: body.tipo,
        principioActivo: body.principioActivo || null,
        laboratorio: body.laboratorio || null,
        retiroDias: body.retiroDias ? parseInt(body.retiroDias) : 0,
        dosisReferencia: body.dosisReferencia || null,
        notas: body.notas || null,
        organizacionId,
      },
    })

    return NextResponse.json(
      { success: true, data: producto },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error al crear producto:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
