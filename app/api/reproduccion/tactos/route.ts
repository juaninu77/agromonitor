import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { animalDelTenant } from "@/lib/api/tenant"

export const GET = withAuth(async (request, { establecimientoIds }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const hembraId = searchParams.get("hembraId")
    const resultado = searchParams.get("resultado")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")

    const where: Record<string, unknown> = {
      hembra: { establecimientoId: { in: establecimientoIds } },
    }

    if (hembraId) where.hembraId = hembraId
    if (resultado) where.resultado = resultado

    if (desde || hasta) {
      where.fecha = {}
      if (desde) (where.fecha as Record<string, unknown>).gte = new Date(desde)
      if (hasta) (where.fecha as Record<string, unknown>).lte = new Date(hasta)
    }

    const tactos = await prisma.evtTacto.findMany({
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
        servicio: {
          select: {
            id: true,
            fecha: true,
            tipo: true,
            toroNombre: true,
          },
        },
      },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json({ success: true, data: tactos })
  } catch (error) {
    console.error("Error al obtener tactos:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request, { establecimientoIds }) => {
  try {
    const body = await request.json()

    if (!body.fecha || !body.resultado || !body.hembraId || !body.metodo) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: fecha, resultado, hembraId, metodo" },
        { status: 400 }
      )
    }

    const hembra = await animalDelTenant(body.hembraId, establecimientoIds)
    if (!hembra) {
      return NextResponse.json(
        { error: "Hembra no encontrada" },
        { status: 404 }
      )
    }

    if (body.servicioId) {
      const servicio = await prisma.evtServicio.findFirst({
        where: {
          id: body.servicioId,
          hembra: { establecimientoId: { in: establecimientoIds } },
        },
      })
      if (!servicio) {
        return NextResponse.json(
          { error: "Servicio no encontrado" },
          { status: 404 }
        )
      }
    }

    const tacto = await prisma.evtTacto.create({
      data: {
        fecha: new Date(body.fecha),
        resultado: body.resultado,
        mesesGest: body.mesesGest ? parseFloat(body.mesesGest) : null,
        fechaProbableParto: body.fechaProbableParto
          ? new Date(body.fechaProbableParto)
          : null,
        metodo: body.metodo,
        veterinario: body.veterinario,
        observ: body.observ,
        hembraId: body.hembraId,
        servicioId: body.servicioId || null,
      },
      include: {
        hembra: { select: { id: true, caravanaVisual: true } },
        servicio: { select: { id: true, fecha: true, tipo: true } },
      },
    })

    return NextResponse.json({ success: true, data: tacto }, { status: 201 })
  } catch (error) {
    console.error("Error al crear tacto:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
