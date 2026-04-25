import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ============================================
// GET /api/establecimientos/[establecimientoId]/lotes
// ============================================
// Retorna los lotes de un establecimiento

export async function GET(
  request: Request,
  { params }: { params: Promise<{ establecimientoId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const { establecimientoId } = await params

    // Verificar que el establecimiento existe y el usuario tiene acceso
    const establecimiento = await prisma.establecimiento.findUnique({
      where: { id: establecimientoId },
      include: {
        organizacion: {
          include: {
            membresias: {
              where: {
                usuarioId: session.user.id,
                esActivo: true,
              },
            },
          },
        },
      },
    })

    if (!establecimiento) {
      return NextResponse.json(
        { error: "Establecimiento no encontrado" },
        { status: 404 }
      )
    }

    if (establecimiento.organizacion.membresias.length === 0) {
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
}

// ============================================
// POST /api/establecimientos/[establecimientoId]/lotes
// ============================================
// Crea un nuevo lote en el establecimiento

export async function POST(
  request: Request,
  { params }: { params: Promise<{ establecimientoId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const { establecimientoId } = await params

    // Verificar que el establecimiento existe y el usuario tiene acceso
    const establecimiento = await prisma.establecimiento.findUnique({
      where: { id: establecimientoId },
      include: {
        organizacion: {
          include: {
            membresias: {
              where: {
                usuarioId: session.user.id,
                esActivo: true,
              },
            },
          },
        },
      },
    })

    if (!establecimiento) {
      return NextResponse.json(
        { error: "Establecimiento no encontrado" },
        { status: 404 }
      )
    }

    const membresia = establecimiento.organizacion.membresias[0]
    if (!membresia) {
      return NextResponse.json(
        { error: "No tienes acceso a este establecimiento" },
        { status: 403 }
      )
    }

    // Verificar rol (solo propietario o administrador pueden crear lotes)
    if (!["propietario", "administrador"].includes(membresia.rol)) {
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
}

