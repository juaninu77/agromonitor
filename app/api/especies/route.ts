import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"

export const GET = withAuth(async () => {
  try {
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
})

export const POST = withAuth(
  async (request) => {
    try {
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
  },
  { roles: ["admin", "encargado"] }
)
