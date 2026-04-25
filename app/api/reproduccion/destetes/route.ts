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
    const animalId = searchParams.get("animalId")
    const metodo = searchParams.get("metodo")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")

    const where: Record<string, unknown> = {}

    if (animalId) where.animalId = animalId
    if (metodo) where.metodo = metodo

    if (desde || hasta) {
      where.fecha = {}
      if (desde) (where.fecha as Record<string, unknown>).gte = new Date(desde)
      if (hasta) (where.fecha as Record<string, unknown>).lte = new Date(hasta)
    }

    const destetes = await prisma.evtDestete.findMany({
      where: where as any,
      include: {
        animal: {
          select: {
            id: true,
            caravanaVisual: true,
            cuig: true,
            sexo: true,
            fechaNacimiento: true,
            raza: { select: { nombre: true } },
            categoria: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json({ success: true, data: destetes })
  } catch (error) {
    console.error("Error al obtener destetes:", error)
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

    if (!body.fecha || !body.animalId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: fecha, animalId" },
        { status: 400 }
      )
    }

    const destete = await prisma.evtDestete.create({
      data: {
        fecha: new Date(body.fecha),
        pesoKg: body.pesoKg ? parseFloat(body.pesoKg) : null,
        edadDias: body.edadDias ? parseInt(body.edadDias) : null,
        metodo: body.metodo || null,
        observ: body.observ,
        animalId: body.animalId,
        loteDesteteId: body.loteDesteteId || null,
      },
      include: {
        animal: {
          select: {
            id: true,
            caravanaVisual: true,
            sexo: true,
            fechaNacimiento: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: destete }, { status: 201 })
  } catch (error) {
    console.error("Error al crear destete:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
