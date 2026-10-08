import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { normalizarRolOrg } from "@/lib/equipo/roles"

// ============================================
// GET /api/organizaciones
// ============================================
// Retorna las organizaciones donde el usuario tiene membresía

export const GET = withAuth(async (_request, ctx) => {
  try {
    const organizaciones = await prisma.organizacion.findMany({
      where: {
        id: { in: ctx.organizacionIds },
      },
      select: {
        id: true,
        nombre: true,
        slug: true,
        logo: true,
        membresias: { where: { usuarioId: ctx.userId }, select: { rol: true, accesoTotal: true } },
      },
      orderBy: { nombre: "asc" },
    })

    // Rol del usuario en cada organización (para permisos de la interfaz y el selector)
    return NextResponse.json(organizaciones.map(({ membresias, ...o }) => ({
      ...o,
      rol: normalizarRolOrg(membresias[0]?.rol),
      accesoTotal: membresias[0]?.accesoTotal ?? true,
    })))
  } catch (error) {
    console.error("Error al obtener organizaciones:", error)
    // Log más detallado en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.error("Detalles del error:", {
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
      })
    }
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        ...(process.env.NODE_ENV === 'development' && {
          details: error instanceof Error ? error.message : 'Error desconocido'
        })
      },
      { status: 500 }
    )
  }
})

// ============================================
// POST /api/organizaciones
// ============================================
// Crea una nueva organización (y membresía como propietario).
// Especial: cualquier usuario autenticado puede crear una organización nueva.

export const POST = withAuth(async (request, ctx) => {
  try {
    const body = await request.json()
    const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : ""

    if (nombre.length < 2 || nombre.length > 120) {
      return NextResponse.json(
        { error: "El nombre es requerido (2 a 120 caracteres)" },
        { status: 400 }
      )
    }

    // Slug único: el nombre no tiene por qué ser único entre organizaciones de distintos usuarios
    const base = nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remover acentos
      .replace(/[^a-z0-9]+/g, "-")     // Reemplazar caracteres especiales
      .replace(/^-+|-+$/g, "")         // Remover guiones al inicio/final
      .slice(0, 50)
    const slug = `${base || "organizacion"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

    // Crear organización y membresía en una transacción
    const organizacion = await prisma.$transaction(async (tx) => {
      // Crear la organización
      const org = await tx.organizacion.create({
        data: {
          nombre,
          slug,
        },
      })

      // Crear membresía como propietario
      await tx.membresia.create({
        data: {
          usuarioId: ctx.userId,
          organizacionId: org.id,
          rol: "propietario",
        },
      })

      return org
    })

    return NextResponse.json(organizacion, { status: 201 })
  } catch (error) {
    console.error("Error al crear organización:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
