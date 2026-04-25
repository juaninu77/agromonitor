import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * @deprecated Usar /api/ventas/documentos en su lugar.
 * Esta ruta se mantiene por compatibilidad pero redirige a la nueva API.
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const estado = searchParams.get("estado")

    const membresias = await prisma.membresia.findMany({
      where: { usuarioId: session.user.id, esActivo: true },
      include: {
        organizacion: {
          include: { establecimientos: true },
        },
      },
    })

    const renspaList = membresias
      .flatMap((m) => m.organizacion.establecimientos)
      .map((e) => e.renspa)
      .filter(Boolean) as string[]

    if (renspaList.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const where: any = {
      OR: [
        { renspaOrigen: { in: renspaList } },
        { renspaDestino: { in: renspaList } },
      ],
    }

    if (estado) {
      where.estado = estado
    }

    const documentos = await prisma.documentoTransito.findMany({
      where,
      orderBy: { fechaEmision: "desc" },
    })

    return NextResponse.json({ success: true, data: documentos })
  } catch (error) {
    console.error("Error al obtener DTAs:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
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
    const {
      numeroDta, tipo, fechaEmision, fechaVencimiento,
      renspaOrigen, nombreOrigen, renspaDestino, nombreDestino,
      especie, cantidadAnimales, categorias, motivo,
      patenteCamion, transportista, observ,
    } = body

    if (!numeroDta || !renspaOrigen || !renspaDestino || !especie || !cantidadAnimales || !motivo) {
      return NextResponse.json(
        { error: "Faltan campos requeridos (numeroDta, renspaOrigen, renspaDestino, especie, cantidadAnimales, motivo)" },
        { status: 400 }
      )
    }

    const existente = await prisma.documentoTransito.findUnique({
      where: { numeroDta },
    })

    if (existente) {
      return NextResponse.json(
        { error: "Ya existe un DTA con ese número" },
        { status: 409 }
      )
    }

    const documento = await prisma.documentoTransito.create({
      data: {
        numeroDta,
        tipo: tipo || "DTe",
        fechaEmision: new Date(fechaEmision),
        fechaVencimiento: new Date(fechaVencimiento),
        renspaOrigen,
        nombreOrigen,
        renspaDestino,
        nombreDestino,
        especie,
        cantidadAnimales,
        categorias,
        motivo,
        estado: "vigente",
        patenteCamion,
        transportista,
        observ,
      },
    })

    return NextResponse.json({ success: true, data: documento }, { status: 201 })
  } catch (error) {
    console.error("Error al crear DTA:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
