import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ============================================
// GET /api/organizaciones
// ============================================
// Retorna las organizaciones donde el usuario tiene membresía

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    // Obtener organizaciones donde el usuario es miembro
    const membresias = await prisma.membresia.findMany({
      where: {
        usuarioId: session.user.id,
        esActivo: true,
      },
      include: {
        organizacion: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            logo: true,
          },
        },
      },
    })

    // Extraer solo las organizaciones
    const organizaciones = membresias.map((m) => m.organizacion)

    return NextResponse.json(organizaciones)
  } catch (error) {
    console.error("Error al obtener organizaciones:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/organizaciones
// ============================================
// Crea una nueva organización (y membresía como propietario)

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { nombre, descripcion } = body

    if (!nombre || typeof nombre !== "string") {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      )
    }

    // Generar slug a partir del nombre
    const slug = nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remover acentos
      .replace(/[^a-z0-9]+/g, "-")     // Reemplazar caracteres especiales
      .replace(/^-+|-+$/g, "")         // Remover guiones al inicio/final

    // Verificar si el slug ya existe
    const existente = await prisma.organizacion.findUnique({
      where: { slug },
    })

    if (existente) {
      return NextResponse.json(
        { error: "Ya existe una organización con ese nombre" },
        { status: 409 }
      )
    }

    // Crear organización y membresía en una transacción
    const organizacion = await prisma.$transaction(async (tx) => {
      // Crear la organización
      const org = await tx.organizacion.create({
        data: {
          nombre,
          slug,
          descripcion,
        },
      })

      // Crear membresía como propietario
      await tx.membresia.create({
        data: {
          usuarioId: session.user.id,
          organizacionId: org.id,
          rol: "propietario",
          fechaAceptacion: new Date(),
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
}

