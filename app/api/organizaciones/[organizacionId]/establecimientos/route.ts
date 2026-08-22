import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"

// ============================================
// GET /api/organizaciones/[organizacionId]/establecimientos
// ============================================
// Retorna los establecimientos de una organización

export const GET = withAuth(async (_request, ctx) => {
  try {
    const { organizacionId } = ctx.params

    // Verificar que el usuario tiene acceso a esta organización
    if (!ctx.organizacionIds.includes(organizacionId)) {
      return NextResponse.json(
        { error: "No tienes acceso a esta organización" },
        { status: 403 }
      )
    }

    // Obtener establecimientos de la organización
    const establecimientos = await prisma.establecimiento.findMany({
      where: {
        organizacionId,
      },
      select: {
        id: true,
        nombre: true,
        hectareas: true,
        renspa: true,
        provincia: true,
        localidad: true,
        ubicacion: true,
      },
      orderBy: {
        nombre: "asc",
      },
    })

    return NextResponse.json(establecimientos)
  } catch (error) {
    console.error("Error al obtener establecimientos:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

// ============================================
// POST /api/organizaciones/[organizacionId]/establecimientos
// ============================================
// Crea un nuevo establecimiento en la organización

export const POST = withAuth(async (request, ctx) => {
  try {
    const { organizacionId } = ctx.params

    // Verificar que el usuario tiene acceso a esta organización
    if (!ctx.organizacionIds.includes(organizacionId)) {
      return NextResponse.json(
        { error: "No tienes acceso a esta organización" },
        { status: 403 }
      )
    }

    // Verificar rol de la membresía (solo propietario o administrador pueden crear establecimientos)
    const membresia = await prisma.membresia.findUnique({
      where: {
        usuarioId_organizacionId: {
          usuarioId: ctx.userId,
          organizacionId,
        },
        esActivo: true,
      },
    })

    if (!membresia || !["propietario", "administrador"].includes(membresia.rol)) {
      return NextResponse.json(
        { error: "No tienes permisos para crear establecimientos" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { nombre, hectareas, renspa, provincia, localidad, ubicacion } = body

    if (!nombre || typeof nombre !== "string") {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      )
    }

    if (hectareas !== undefined && (typeof hectareas !== "number" || hectareas <= 0)) {
      return NextResponse.json(
        { error: "Las hectáreas deben ser un número positivo" },
        { status: 400 }
      )
    }

    // Crear establecimiento
    const establecimiento = await prisma.establecimiento.create({
      data: {
        nombre,
        hectareas: hectareas || null,
        renspa: renspa || null,
        provincia: provincia || null,
        localidad: localidad || null,
        ubicacion: ubicacion || null,
        organizacionId,
      },
    })

    return NextResponse.json(establecimiento, { status: 201 })
  } catch (error) {
    console.error("Error al crear establecimiento:", error)

    // Manejar error de unicidad
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un establecimiento con ese nombre en esta organización" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
