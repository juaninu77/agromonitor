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
    const motivo = searchParams.get("motivo")
    const desde = searchParams.get("desde")
    const hasta = searchParams.get("hasta")

    const membresia = await prisma.membresia.findFirst({
      where: { usuarioId: session.user.id, esActivo: true },
      select: { organizacionId: true },
    })

    if (!membresia) {
      return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    const clientesOrg = await prisma.cliente.findMany({
      where: { organizacionId: membresia.organizacionId },
      select: { id: true },
    })
    const clienteIds = clientesOrg.map((c) => c.id)

    const where: Record<string, unknown> = {}

    if (motivo) {
      where.motivo = motivo
    }

    if (desde || hasta) {
      where.fecha = {
        ...(desde ? { gte: new Date(desde) } : {}),
        ...(hasta ? { lte: new Date(hasta) } : {}),
      }
    }

    if (clienteIds.length > 0) {
      where.OR = [
        { clienteId: { in: clienteIds } },
        { clienteId: null },
      ]
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

    return NextResponse.json({ success: true, data: bajas })
  } catch (error) {
    console.error("Error al obtener bajas:", error)
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

    const animal = await prisma.animal.findUnique({
      where: { id: body.animalId },
    })

    if (!animal) {
      return NextResponse.json({ error: "Animal no encontrado" }, { status: 404 })
    }

    if (animal.estadoVital !== "activo") {
      return NextResponse.json(
        { error: "El animal ya tiene una baja registrada o no está activo" },
        { status: 400 }
      )
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

    return NextResponse.json({ success: true, data: baja }, { status: 201 })
  } catch (error) {
    console.error("Error al crear baja:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
