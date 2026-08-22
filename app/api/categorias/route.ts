import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { scopeOrganizacion } from "@/lib/api/tenant"

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const especieId = searchParams.get("especieId")
    const especieNombre = searchParams.get("especie")

    const where: Record<string, unknown> = {
      ...scopeOrganizacion(ctx.organizacionIds),
    }

    if (especieId) {
      where.especieId = especieId
    } else if (especieNombre) {
      const especie = await prisma.especie.findFirst({
        where: {
          nombre: especieNombre.toLowerCase(),
          ...scopeOrganizacion(ctx.organizacionIds),
        },
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
  async (request, ctx) => {
    try {
      const body = await request.json()
      if (!body.nombre?.trim()) {
        return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
      }
      if (!body.especieId) {
        return NextResponse.json({ error: "La especie es requerida" }, { status: 400 })
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
          { error: "Se requiere organizacionId para crear la categoría" },
          { status: 400 }
        )
      }

      // La especie referenciada debe pertenecer a la organización del tenant
      const especie = await prisma.especie.findFirst({
        where: { id: body.especieId, organizacionId },
      })
      if (!especie) {
        return NextResponse.json(
          { error: "La especie no pertenece a la organización" },
          { status: 400 }
        )
      }

      const categoria = await prisma.categoria.create({
        data: {
          nombre: body.nombre.trim(),
          especieId: body.especieId,
          organizacionId,
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
