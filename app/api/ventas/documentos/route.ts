import { NextResponse } from "next/server"
import { resolverEstablecimientoDestino } from "@/lib/api/tenant"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const estado = searchParams.get("estado")
    const tipo = searchParams.get("tipo")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")

    if (ctx.organizacionIds.length === 0) {
      return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    // Un DTA es visible para el tenant si lo posee (establecimientoId) o si
    // alguno de sus establecimientos aparece como origen O destino (por RENSPA),
    // así no desaparecen los documentos de hacienda entrante.
    const establecimientos = await prisma.establecimiento.findMany({
      where: { id: { in: ctx.establecimientoIds } },
      select: { renspa: true },
    })
    const renspas = establecimientos
      .map((e) => e.renspa)
      .filter((r): r is string => !!r)

    const where: Record<string, unknown> = {
      OR: [
        { establecimientoId: { in: ctx.establecimientoIds } },
        ...(renspas.length
          ? [{ renspaOrigen: { in: renspas } }, { renspaDestino: { in: renspas } }]
          : []),
      ],
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
})

export const POST = withAuth(async (request, ctx) => {
  try {
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

    const establecimientoId = resolverEstablecimientoDestino(
      body.establecimientoId,
      ctx.establecimientoIds
    )

    if (!establecimientoId) {
      return NextResponse.json(
        { error: "Debe indicar un establecimiento válido" },
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
        establecimientoId,
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
})
