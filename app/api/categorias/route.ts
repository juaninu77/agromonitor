import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"

export const GET = withAuth(async (request) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const especieId = searchParams.get("especieId")
    const especieNombre = searchParams.get("especie")

    const where: Record<string, unknown> = {}

    if (especieId) {
      where.especieId = especieId
    } else if (especieNombre) {
      const especie = await prisma.especie.findFirst({
        where: { nombre: especieNombre.toLowerCase() },
      })
      if (especie) where.especieId = especie.id
    }

    const categorias = await prisma.categoria.findMany({
      where: where as any,
      include: {
        especie: { select: { id: true, nombre: true } },
        _count: { select: { animales: true } },
      },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json({ success: true, data: categorias })
  } catch (error) {
    console.error("Error al obtener categorías:", error)
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

      const categoria = await prisma.categoria.create({
        data: {
          nombre: body.nombre.trim(),
          especieId: body.especieId,
          sexo: body.sexo || null,
          edadMinMeses: body.edadMinMeses ? parseInt(body.edadMinMeses) : null,
          edadMaxMeses: body.edadMaxMeses ? parseInt(body.edadMaxMeses) : null,
        },
        include: { especie: { select: { id: true, nombre: true } } },
      })

      return NextResponse.json({ success: true, data: categoria }, { status: 201 })
    } catch (error) {
      console.error("Error al crear categoría:", error)
      return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
    }
  },
  { roles: ["admin", "encargado"] }
)
