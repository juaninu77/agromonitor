import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const membresia = await prisma.membresia.findFirst({
      where: { usuarioId: session.user.id, esActivo: true },
      select: { organizacionId: true },
    })

    if (!membresia) {
      return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    const clientes = await prisma.cliente.findMany({
      where: { organizacionId: membresia.organizacionId },
      include: {
        _count: { select: { ventas: true } },
      },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json({ success: true, data: clientes })
  } catch (error) {
    console.error("Error al obtener clientes:", error)
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

    const membresia = await prisma.membresia.findFirst({
      where: { usuarioId: session.user.id, esActivo: true },
      select: { organizacionId: true },
    })

    if (!membresia) {
      return NextResponse.json({ error: "Sin organización" }, { status: 403 })
    }

    const body = await request.json()

    if (!body.nombre) {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      )
    }

    const cliente = await prisma.cliente.create({
      data: {
        nombre: body.nombre,
        cuit: body.cuit || null,
        tipo: body.tipo || [],
        renspa: body.renspa || null,
        contactoNombre: body.contactoNombre || null,
        contactoTel: body.contactoTel || null,
        notas: body.notas || null,
        organizacionId: membresia.organizacionId,
      },
    })

    return NextResponse.json({ success: true, data: cliente }, { status: 201 })
  } catch (error) {
    console.error("Error al crear cliente:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
