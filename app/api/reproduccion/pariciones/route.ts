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
    const madreId = searchParams.get("madreId")
    const resultado = searchParams.get("resultado")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")

    const where: Record<string, unknown> = {}

    if (madreId) where.madreId = madreId
    if (resultado) where.resultado = resultado

    if (desde || hasta) {
      where.fecha = {}
      if (desde) (where.fecha as Record<string, unknown>).gte = new Date(desde)
      if (hasta) (where.fecha as Record<string, unknown>).lte = new Date(hasta)
    }

    const pariciones = await prisma.evtParicion.findMany({
      where: where as any,
      include: {
        madre: {
          select: {
            id: true,
            caravanaVisual: true,
            cuig: true,
            raza: { select: { nombre: true } },
          },
        },
        padre: {
          select: {
            id: true,
            caravanaVisual: true,
            cuig: true,
          },
        },
        nacido: {
          select: {
            id: true,
            caravanaVisual: true,
            sexo: true,
          },
        },
      },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json({ success: true, data: pariciones })
  } catch (error) {
    console.error("Error al obtener pariciones:", error)
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

    if (!body.fecha || !body.resultado || !body.madreId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: fecha, resultado, madreId" },
        { status: 400 }
      )
    }

    const paricion = await prisma.evtParicion.create({
      data: {
        fecha: new Date(body.fecha),
        resultado: body.resultado,
        pesoNacerKg: body.pesoNacerKg ? parseFloat(body.pesoNacerKg) : null,
        tipoParto: body.tipoParto || null,
        dificultad: body.dificultad ? parseInt(body.dificultad) : null,
        sexoCria: body.sexoCria || null,
        observ: body.observ,
        madreId: body.madreId,
        padreId: body.padreId || null,
        padreExterno: body.padreExterno || null,
        nacidoAnimalId: body.nacidoAnimalId || null,
      },
      include: {
        madre: { select: { id: true, caravanaVisual: true } },
        padre: { select: { id: true, caravanaVisual: true } },
        nacido: { select: { id: true, caravanaVisual: true, sexo: true } },
      },
    })

    return NextResponse.json({ success: true, data: paricion }, { status: 201 })
  } catch (error) {
    console.error("Error al crear parición:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
