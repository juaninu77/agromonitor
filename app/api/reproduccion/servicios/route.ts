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
    const hembraId = searchParams.get("hembraId")
    const machoId = searchParams.get("machoId")
    const toradaId = searchParams.get("toradaId")
    const tipo = searchParams.get("tipo")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")

    const where: Record<string, unknown> = {}

    if (hembraId) where.hembraId = hembraId
    if (machoId) where.machoId = machoId
    if (toradaId) where.toradaId = toradaId
    if (tipo) where.tipo = tipo

    if (desde || hasta) {
      where.fecha = {}
      if (desde) (where.fecha as Record<string, unknown>).gte = new Date(desde)
      if (hasta) (where.fecha as Record<string, unknown>).lte = new Date(hasta)
    }

    const servicios = await prisma.evtServicio.findMany({
      where: where as any,
      include: {
        hembra: {
          select: {
            id: true,
            caravanaVisual: true,
            cuig: true,
            categoria: { select: { nombre: true } },
            raza: { select: { nombre: true } },
          },
        },
        macho: {
          select: {
            id: true,
            caravanaVisual: true,
            cuig: true,
          },
        },
        torada: {
          select: { id: true, nombre: true },
        },
        tacto: true,
      },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json({ success: true, data: servicios })
  } catch (error) {
    console.error("Error al obtener servicios:", error)
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

    if (!body.fecha || !body.tipo || !body.hembraId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: fecha, tipo, hembraId" },
        { status: 400 }
      )
    }

    const servicio = await prisma.evtServicio.create({
      data: {
        fecha: new Date(body.fecha),
        tipo: body.tipo,
        toroNombre: body.toroNombre,
        loteSemen: body.loteSemen,
        inseminador: body.inseminador,
        observ: body.observ,
        hembraId: body.hembraId,
        machoId: body.machoId || null,
        toradaId: body.toradaId || null,
      },
      include: {
        hembra: { select: { id: true, caravanaVisual: true } },
        macho: { select: { id: true, caravanaVisual: true } },
        torada: { select: { id: true, nombre: true } },
        tacto: true,
      },
    })

    return NextResponse.json({ success: true, data: servicio }, { status: 201 })
  } catch (error) {
    console.error("Error al crear servicio:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
