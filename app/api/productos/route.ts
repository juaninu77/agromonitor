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
    const tipo = searchParams.get("tipo")
    const busqueda = searchParams.get("busqueda")

    const where: Record<string, unknown> = {}

    if (tipo) {
      where.tipo = tipo
    }

    if (busqueda) {
      where.OR = [
        { nombre: { contains: busqueda, mode: "insensitive" } },
        { principioActivo: { contains: busqueda, mode: "insensitive" } },
        { laboratorio: { contains: busqueda, mode: "insensitive" } },
      ]
    }

    const productos = await prisma.producto.findMany({
      where: where as any,
      include: {
        lotes: {
          orderBy: { vencimiento: "asc" },
        },
        _count: {
          select: { eventosSanidad: true },
        },
      },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json({ success: true, data: productos })
  } catch (error) {
    console.error("Error al obtener productos:", error)
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

    if (!body.nombre || !body.tipo) {
      return NextResponse.json(
        { error: "Se requiere nombre y tipo de producto" },
        { status: 400 }
      )
    }

    const tiposValidos = [
      "vacuna",
      "antiparasitario",
      "antibiotico",
      "mineral",
      "vitaminico",
      "otro",
    ]

    if (!tiposValidos.includes(body.tipo)) {
      return NextResponse.json(
        { error: `Tipo inválido. Debe ser uno de: ${tiposValidos.join(", ")}` },
        { status: 400 }
      )
    }

    const producto = await prisma.producto.create({
      data: {
        nombre: body.nombre,
        tipo: body.tipo,
        principioActivo: body.principioActivo || null,
        laboratorio: body.laboratorio || null,
        retiroDias: body.retiroDias ? parseInt(body.retiroDias) : 0,
        dosisReferencia: body.dosisReferencia || null,
        notas: body.notas || null,
      },
    })

    return NextResponse.json(
      { success: true, data: producto },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error al crear producto:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
