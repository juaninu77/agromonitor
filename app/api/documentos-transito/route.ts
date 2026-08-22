import { NextResponse } from "next/server"
import { resolverEstablecimientoDestino, scopeEstablecimiento } from "@/lib/api/tenant"
import { withAuth } from "@/lib/api/with-auth"
import { logAudit } from "@/lib/api/audit-log"
import { prisma } from "@/lib/prisma"

/**
 * @deprecated Usar /api/ventas/documentos en su lugar.
 * Esta ruta se mantiene por compatibilidad pero redirige a la nueva API.
 */

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const estado = searchParams.get("estado")

    if (ctx.establecimientoIds.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const where: any = {
      ...scopeEstablecimiento(ctx.establecimientoIds),
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
})

export const POST = withAuth(async (request, ctx) => {
  try {
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
        establecimientoId,
      },
    })

    await logAudit({
      userId: ctx.userId,
      tabla: "documentos_transito",
      rowPk: documento.id,
      accion: "INSERT",
      detalle: { numeroDta, motivo },
      organizacionId: ctx.organizacionDeEstablecimiento[establecimientoId],
    })

    return NextResponse.json({ success: true, data: documento }, { status: 201 })
  } catch (error) {
    console.error("Error al crear DTA:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
