import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ============================================
// GET /api/organizaciones/[organizacionId]/campos
// ============================================
// Retorna los campos de una organización

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

    // Obtener campos de la organización
    const campos = await prisma.campo.findMany({
      where: {
        organizacionId,
      },
      select: {
        id: true,
        nombre: true,
        hectareas: true,
        tipo: true,
        renspa: true,
        provincia: true,
        localidad: true,
      },
      orderBy: {
        nombre: "asc",
      },
    })

    return NextResponse.json(campos)
  } catch (error) {
    console.error("Error al obtener campos:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/organizaciones/[organizacionId]/campos
// ============================================
// Crea un nuevo campo en la organización

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

    // Verificar rol (solo propietario o administrador pueden crear campos)
    if (!["propietario", "administrador"].includes(membresia.rol)) {
      return NextResponse.json(
        { error: "No tienes permisos para crear campos" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { nombre, hectareas, tipo, renspa, provincia, localidad } = body

    if (!nombre || typeof nombre !== "string") {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      )
    }

    if (!hectareas || typeof hectareas !== "number" || hectareas <= 0) {
      return NextResponse.json(
        { error: "Las hectáreas deben ser un número positivo" },
        { status: 400 }
      )
    }

    // Crear campo
    const campo = await prisma.campo.create({
      data: {
        nombre,
        hectareas,
        tipo: tipo || "propio",
        renspa,
        provincia,
        localidad,
        organizacionId,
      },
    })

    return NextResponse.json(campo, { status: 201 })
  } catch (error) {
    console.error("Error al crear campo:", error)
    
    // Manejar error de unicidad
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un campo con ese nombre en esta organización" },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

