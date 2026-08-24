import { NextResponse } from "next/server"
import { animalDelTenant, scopeEventoAnimal } from "@/lib/api/tenant"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { decimalToNumber } from "@/lib/api/serialize"

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const motivo = searchParams.get("motivo")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")

    if (ctx.organizacionIds.length === 0) {
      return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    const where: Record<string, unknown> = {
      ...scopeEventoAnimal(ctx.establecimientoIds),
    }

    if (motivo) {
      where.motivo = motivo
    }

    if (desde || hasta) {
      where.fecha = {
        ...(desde ? { gte: new Date(desde) } : {}),
        ...(hasta ? { lte: new Date(hasta) } : {}),
      }
    }

    const bajas = await prisma.evtBaja.findMany({
      where: where as any,
      include: {
        animal: {
          include: {
            raza: true,
            categoria: true,
          },
        },
        cliente: true,
      },
      orderBy: { fecha: "desc" },
    })

    const data = bajas.map((baja) => ({
      ...baja,
      precioKg: decimalToNumber(baja.precioKg),
      precioTotal: decimalToNumber(baja.precioTotal),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error al obtener bajas:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request, ctx) => {
  try {
    const body = await request.json()

    if (!body.animalId || !body.fecha || !body.motivo) {
      return NextResponse.json(
        { error: "animalId, fecha y motivo son requeridos" },
        { status: 400 }
      )
    }

    const motivosValidos = ["venta", "muerte", "faena", "descarte", "robo", "otro"]
    if (!motivosValidos.includes(body.motivo)) {
      return NextResponse.json(
        { error: `Motivo inválido. Opciones: ${motivosValidos.join(", ")}` },
        { status: 400 }
      )
    }

    const animal = await animalDelTenant(body.animalId, ctx.establecimientoIds)

    if (!animal) {
      return NextResponse.json({ error: "Animal no encontrado" }, { status: 404 })
    }

    if (animal.estadoVital !== "activo") {
      return NextResponse.json(
        { error: "El animal ya tiene una baja registrada o no está activo" },
        { status: 400 }
      )
    }

    if (body.clienteId) {
      const cliente = await prisma.cliente.findFirst({
        where: {
          id: body.clienteId,
          organizacionId: { in: ctx.organizacionIds },
        },
      })

      if (!cliente) {
        return NextResponse.json(
          { error: "El cliente no pertenece a tu organización" },
          { status: 403 }
        )
      }
    }

    const estadoVitalMap: Record<string, string> = {
      venta: "vendido",
      muerte: "muerto",
      faena: "baja",
      descarte: "baja",
      robo: "baja",
      otro: "baja",
    }

    const [baja] = await prisma.$transaction([
      prisma.evtBaja.create({
        data: {
          fecha: new Date(body.fecha),
          motivo: body.motivo,
          pesoVivoKg: body.pesoVivoKg ? parseFloat(body.pesoVivoKg) : null,
          precioKg: body.precioKg ? parseFloat(body.precioKg) : null,
          precioTotal: body.precioTotal ? parseFloat(body.precioTotal) : null,
          dtaNumero: body.dtaNumero || null,
          facturaNumero: body.facturaNumero || null,
          observ: body.observ || null,
          animalId: body.animalId,
          clienteId: body.clienteId || null,
        },
        include: {
          animal: { include: { raza: true, categoria: true } },
          cliente: true,
        },
      }),
      prisma.animal.update({
        where: { id: body.animalId },
        data: { estadoVital: estadoVitalMap[body.motivo] || "baja" },
      }),
    ])

    const data = {
      ...baja,
      precioKg: decimalToNumber(baja.precioKg),
      precioTotal: decimalToNumber(baja.precioTotal),
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error("Error al crear baja:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
