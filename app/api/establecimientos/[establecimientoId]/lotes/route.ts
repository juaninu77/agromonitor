import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"

// ============================================
// GET /api/establecimientos/[establecimientoId]/lotes
// ============================================
// Retorna los lotes de un establecimiento

export const GET = withAuth(async (_request, ctx) => {
  try {
    const { establecimientoId } = ctx.params

    // Verificar que el usuario tiene acceso a este establecimiento
    if (!ctx.establecimientoIds.includes(establecimientoId)) {
      return NextResponse.json(
        { error: "No tienes acceso a este establecimiento" },
        { status: 403 }
      )
    }

    // Obtener lotes del establecimiento
    const lotes = await prisma.lote.findMany({
      where: {
        establecimientoId,
      },
      include: {
        especie: true,
        _count: {
          select: {
            animalLoteHist: {
              where: {
                hasta: null,
              },
            },
          },
        },
      },
      orderBy: {
        nombre: "asc",
      },
    })

    // Transformar para incluir cantidad de animales
    const lotesConCantidad = lotes.map((lote) => ({
      id: lote.id,
      nombre: lote.nombre,
      tipo: lote.tipo,
      objetivo: lote.objetivo,
      activo: lote.activo,
      especieId: lote.especieId,
      establecimientoId: lote.establecimientoId,
      especie: lote.especie,
      cantidadAnimales: lote._count.animalLoteHist,
      createdAt: lote.createdAt,
      updatedAt: lote.updatedAt,
    }))

    return NextResponse.json(lotesConCantidad)
  } catch (error) {
    console.error("Error al obtener lotes:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

// ============================================
// POST /api/establecimientos/[establecimientoId]/lotes
// ============================================
// Crea un nuevo lote en el establecimiento

export const POST = withAuth(async (request, ctx) => {
  try {
    const { establecimientoId } = ctx.params

    // Verificar que el usuario tiene acceso a este establecimiento
    if (!ctx.establecimientoIds.includes(establecimientoId)) {
      return NextResponse.json(
        { error: "No tienes acceso a este establecimiento" },
        { status: 403 }
      )
    }

    const establecimiento = await prisma.establecimiento.findUnique({
      where: { id: establecimientoId },
      select: { organizacionId: true },
    })

    if (!establecimiento) {
      return NextResponse.json(
        { error: "Establecimiento no encontrado" },
        { status: 404 }
      )
    }

    // Verificar rol de la membresía (solo propietario o administrador pueden crear lotes)
    const membresia = await prisma.membresia.findUnique({
      where: {
        usuarioId_organizacionId: {
          usuarioId: ctx.userId,
          organizacionId: establecimiento.organizacionId,
        },
        esActivo: true,
      },
    })

    if (!membresia || !["propietario", "administrador"].includes(membresia.rol)) {
      return NextResponse.json(
        { error: "No tienes permisos para crear lotes" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { nombre, tipo, objetivo, especieId } = body

    if (!nombre || typeof nombre !== "string") {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      )
    }

    if (!tipo || !["recria", "engorde", "reproductivo", "mixto", "descarte"].includes(tipo)) {
      return NextResponse.json(
        { error: "El tipo de lote es requerido y debe ser válido" },
        { status: 400 }
      )
    }

    if (!especieId || typeof especieId !== "string") {
      return NextResponse.json(
        { error: "La especie es requerida" },
        { status: 400 }
      )
    }

    // Verificar que la especie existe
    const especie = await prisma.especie.findUnique({
      where: { id: especieId },
    })

    if (!especie) {
      return NextResponse.json(
        { error: "La especie especificada no existe" },
        { status: 400 }
      )
    }

    // Crear lote
    const lote = await prisma.lote.create({
      data: {
        nombre,
        tipo,
        objetivo: objetivo || null,
        especieId,
        establecimientoId,
        activo: true,
      },
      include: {
        especie: true,
      },
    })

    return NextResponse.json(lote, { status: 201 })
  } catch (error) {
    console.error("Error al crear lote:", error)

    // Manejar error de unicidad
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un lote con ese nombre en este establecimiento" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
