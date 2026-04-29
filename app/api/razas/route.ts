import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const especieId = request.nextUrl.searchParams.get("especieId")
    const where: Record<string, unknown> = {}
    if (especieId) where.especieId = especieId

    const razas = await prisma.raza.findMany({
      where: where as any,
      include: { especie: { select: { id: true, nombre: true } }, _count: { select: { animales: true } } },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json({ success: true, data: razas })
  } catch (error) {
    console.error("Error al obtener razas:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
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
    if (!body.especieId) {
      return NextResponse.json({ error: "La especie es requerida" }, { status: 400 })
    }

    const raza = await prisma.raza.create({
      data: { nombre: body.nombre.trim(), especieId: body.especieId },
      include: { especie: { select: { id: true, nombre: true } } },
    })

    return NextResponse.json({ success: true, data: raza }, { status: 201 })
  } catch (error) {
    console.error("Error al crear raza:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
}
