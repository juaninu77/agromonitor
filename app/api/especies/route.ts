import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { scopeOrganizacion } from "@/lib/api/tenant"

export const GET = withAuth(async (request, ctx) => {
  try {
    const especies = await prisma.especie.findMany({
      where: scopeOrganizacion(ctx.organizacionIds),
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
  async (request, ctx) => {
    try {
      const body = await request.json()
      if (!body.nombre?.trim()) {
        return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
      }

      // Resolver organización destino (scoping multi-tenant)
      let organizacionId: string | undefined = body.organizacionId
      if (organizacionId) {
        if (!ctx.organizacionIds.includes(organizacionId)) {
          return NextResponse.json(
            { error: "No tienes acceso a esta organización" },
            { status: 403 }
          )
        }
      } else if (ctx.organizacionIds.length === 1) {
        organizacionId = ctx.organizacionIds[0]
      } else {
        return NextResponse.json(
          { error: "Se requiere organizacionId para crear la especie" },
          { status: 400 }
        )
      }

      const especie = await prisma.especie.create({
        data: {
          nombre: body.nombre.trim().toLowerCase(),
          descripcion: body.descripcion?.trim() || null,
          organizacionId,
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
