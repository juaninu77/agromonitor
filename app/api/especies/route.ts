import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const especies = await prisma.especie.findMany({
      include: {
        _count: { select: { razas: true, categorias: true, animales: true } },
      },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json({ success: true, data: especies })
  } catch (error) {
    console.error("Error al obtener especies:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await request.json()
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    }

    const especie = await prisma.especie.create({
      data: {
        nombre: body.nombre.trim().toLowerCase(),
        descripcion: body.descripcion?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: especie }, { status: 201 })
  } catch (error) {
    console.error("Error al crear especie:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
}

