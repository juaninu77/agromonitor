import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"

export const GET = withAuth(async (request) => {
  try {
    const especieIdParam = request.nextUrl.searchParams.get("especieId")
    const especieNombre = request.nextUrl.searchParams.get("especie")

    const where: Record<string, unknown> = {}

    if (especieIdParam) {
      where.especieId = especieIdParam
    } else if (especieNombre) {
      const especie = await prisma.especie.findFirst({
        where: { nombre: especieNombre.toLowerCase() },
      })
      if (especie) where.especieId = especie.id
    }

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
})

export const POST = withAuth(
  async (request) => {
    try {
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
  },
  { roles: ["admin", "encargado"] }
)
