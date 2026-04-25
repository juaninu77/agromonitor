import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ============================================
// GET /api/organizaciones/[organizacionId]/establecimientos
// ============================================
// Retorna los establecimientos de una organización

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizacionId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const { organizacionId } = await params

    // Verificar que el usuario tiene acceso a esta organización
    const membresia = await prisma.membresia.findUnique({
      where: {
        usuarioId_organizacionId: {
          usuarioId: session.user.id,
          organizacionId,
        },
        esActivo: true,
      },
    })

    if (!membresia) {
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
}

// ============================================
// POST /api/organizaciones/[organizacionId]/establecimientos
// ============================================
// Crea un nuevo establecimiento en la organización

export async function POST(
  request: Request,
  { params }: { params: Promise<{ organizacionId: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const { organizacionId } = await params

    // Verificar que el usuario tiene acceso y permisos
    const membresia = await prisma.membresia.findUnique({
      where: {
        usuarioId_organizacionId: {
          usuarioId: session.user.id,
          organizacionId,
        },
        esActivo: true,
      },
    })

    if (!membresia) {
      return NextResponse.json(
        { error: "No tienes acceso a esta organización" },
        { status: 403 }
      )
    }

    // Verificar rol (solo propietario o administrador pueden crear establecimientos)
    if (!["propietario", "administrador"].includes(membresia.rol)) {
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
}

