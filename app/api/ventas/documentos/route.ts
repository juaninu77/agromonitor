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
    const estado = searchParams.get("estado")
    const tipo = searchParams.get("tipo")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")

    const membresia = await prisma.membresia.findFirst({
      where: { usuarioId: session.user.id, esActivo: true },
      select: { organizacionId: true },
    })

    if (!membresia) {
      return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    const establecimientos = await prisma.establecimiento.findMany({
      where: { organizacionId: membresia.organizacionId },
      select: { renspa: true },
    })
    const renspas = establecimientos
      .map((e) => e.renspa)
      .filter((r): r is string => r !== null)

    const where: Record<string, unknown> = {}

    if (renspas.length > 0) {
      where.OR = [
        { renspaOrigen: { in: renspas } },
        { renspaDestino: { in: renspas } },
      ]
    }

    if (estado) {
      where.estado = estado
    }

    if (tipo) {
      where.tipo = tipo
    }

    if (desde || hasta) {
      where.fechaEmision = {
        ...(desde ? { gte: new Date(desde) } : {}),
        ...(hasta ? { lte: new Date(hasta) } : {}),
      }
    }

    const documentos = await prisma.documentoTransito.findMany({
      where: where as any,
      orderBy: { fechaEmision: "desc" },
    })

    return NextResponse.json({ success: true, data: documentos })
  } catch (error) {
    console.error("Error al obtener documentos:", error)
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

    if (!body.numeroDta || !body.renspaOrigen || !body.renspaDestino || !body.especie) {
      return NextResponse.json(
        { error: "numeroDta, renspaOrigen, renspaDestino y especie son requeridos" },
        { status: 400 }
      )
    }

    const motivosValidos = ["venta", "faena", "invernada", "cambio_campo"]
    if (body.motivo && !motivosValidos.includes(body.motivo)) {
      return NextResponse.json(
        { error: `Motivo inválido. Opciones: ${motivosValidos.join(", ")}` },
        { status: 400 }
      )
    }

    const existente = await prisma.documentoTransito.findUnique({
      where: { numeroDta: body.numeroDta },
    })

    if (existente) {
      return NextResponse.json(
        { error: "Ya existe un documento con ese número" },
        { status: 409 }
      )
    }

    const documento = await prisma.documentoTransito.create({
      data: {
        numeroDta: body.numeroDta,
        tipo: body.tipo || "DTe",
        fechaEmision: new Date(body.fechaEmision || new Date()),
        fechaVencimiento: new Date(body.fechaVencimiento),
        fechaUso: body.fechaUso ? new Date(body.fechaUso) : null,
        renspaOrigen: body.renspaOrigen,
        nombreOrigen: body.nombreOrigen || null,
        renspaDestino: body.renspaDestino,
        nombreDestino: body.nombreDestino || null,
        especie: body.especie,
        cantidadAnimales: parseInt(body.cantidadAnimales) || 0,
        categorias: body.categorias || null,
        motivo: body.motivo || "venta",
        estado: body.estado || "vigente",
        patenteCamion: body.patenteCamion || null,
        transportista: body.transportista || null,
        observ: body.observ || null,
      },
    })

    return NextResponse.json({ success: true, data: documento }, { status: 201 })
  } catch (error) {
    console.error("Error al crear documento:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
