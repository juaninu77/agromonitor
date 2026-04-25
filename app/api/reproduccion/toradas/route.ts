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
    const tipo = searchParams.get("tipo")
    const activa = searchParams.get("activa")

    const where: Record<string, unknown> = {}

    if (loteId) where.loteId = loteId
    if (tipo) where.tipo = tipo
    if (activa === "true") where.fechaFin = null

    const toradas = await prisma.torada.findMany({
      where: where as any,
      include: {
        lote: {
          include: { establecimiento: true },
        },
        servicios: {
          include: {
            hembra: { select: { id: true, caravanaVisual: true } },
            tacto: true,
          },
        },
      },
      orderBy: { fechaInicio: "desc" },
    })

    return NextResponse.json({ success: true, data: toradas })
  } catch (error) {
    console.error("Error al obtener toradas:", error)
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

    if (!body.nombre || !body.fechaInicio || !body.tipo || !body.loteId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: nombre, fechaInicio, tipo, loteId" },
        { status: 400 }
      )
    }

    const torada = await prisma.torada.create({
      data: {
        nombre: body.nombre,
        fechaInicio: new Date(body.fechaInicio),
        fechaFin: body.fechaFin ? new Date(body.fechaFin) : null,
        tipo: body.tipo,
        cantidadHembras: body.cantidadHembras ? parseInt(body.cantidadHembras) : null,
        cantidadMachos: body.cantidadMachos ? parseInt(body.cantidadMachos) : null,
        observ: body.observ,
        loteId: body.loteId,
      },
      include: {
        lote: true,
        servicios: true,
      },
    })

    return NextResponse.json({ success: true, data: torada }, { status: 201 })
  } catch (error) {
    console.error("Error al crear torada:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
