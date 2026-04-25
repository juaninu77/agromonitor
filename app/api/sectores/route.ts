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
    const establecimientoId = searchParams.get("establecimientoId")

    if (!establecimientoId) {
      return NextResponse.json(
        { error: "Se requiere establecimientoId" },
        { status: 400 }
      )
    }

    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const sectores = await prisma.sector.findMany({
      where: {
        establecimientoId,
        activo: true,
      },
      include: {
        _count: {
          select: {
            movimientosOrigen: true,
            movimientosDestino: true,
          },
        },
        pastoreosIngreso: {
          where: { egreso: null },
          include: { lote: true },
          take: 1,
        },
        mediciones: {
          orderBy: { fecha: "desc" },
          take: 1,
        },
      },
      orderBy: { nombre: "asc" },
    })

    const data = sectores.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      tipo: s.tipo,
      superficieHa: s.superficieHa,
      uso: s.uso,
      capacidad: s.capacidad,
      tieneAgua: s.tieneAgua,
      tieneSombra: s.tieneSombra,
      tieneBalanza: s.tieneBalanza,
      descripcion: s.descripcion,
      activo: s.activo,
      movimientosRecientes:
        s._count.movimientosOrigen + s._count.movimientosDestino,
      pastoreoActivo: s.pastoreosIngreso[0] ?? null,
      ultimaMedicion: s.mediciones[0] ?? null,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error al obtener sectores:", error)
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

    if (!body.nombre || !body.tipo || !body.establecimientoId) {
      return NextResponse.json(
        { error: "Se requieren nombre, tipo y establecimientoId" },
        { status: 400 }
      )
    }

    const sector = await prisma.sector.create({
      data: {
        nombre: body.nombre,
        tipo: body.tipo,
        superficieHa: body.superficieHa ? parseFloat(body.superficieHa) : null,
        uso: body.uso || null,
        capacidad: body.capacidad ? parseInt(body.capacidad) : null,
        tieneAgua: body.tieneAgua ?? false,
        tieneSombra: body.tieneSombra ?? false,
        tieneBalanza: body.tieneBalanza ?? false,
        descripcion: body.descripcion || null,
        establecimientoId: body.establecimientoId,
      },
    })

    return NextResponse.json({ success: true, data: sector }, { status: 201 })
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un sector con ese nombre en este establecimiento" },
        { status: 409 }
      )
    }
    console.error("Error al crear sector:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
