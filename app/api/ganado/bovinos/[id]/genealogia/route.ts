import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// ============================================
// GET /api/ganado/bovinos/[id]/genealogia
// ============================================
// Retorna un bovino con su árbol genealógico (hasta 2 generaciones)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const { id } = await params

    // Obtener bovino con sus padres y abuelos
    const bovino = await prisma.bovino.findUnique({
      where: { id },
      include: {
        // Padre y sus padres (abuelos paternos)
        padre: {
          include: {
            padre: true,  // Abuelo paterno
            madre: true,  // Abuela paterna
          },
        },
        // Madre y sus padres (abuelos maternos)
        madre: {
          include: {
            padre: true,  // Abuelo materno
            madre: true,  // Abuela materna
          },
        },
        // Hijos (descendencia)
        hijosComoPadre: {
          select: {
            id: true,
            numero: true,
            categoria: true,
            fechaNacimiento: true,
          },
          take: 10,
        },
        hijosComoMadre: {
          select: {
            id: true,
            numero: true,
            categoria: true,
            fechaNacimiento: true,
          },
          take: 10,
        },
      },
    })

    if (!bovino) {
      return NextResponse.json(
        { error: "Bovino no encontrado" },
        { status: 404 }
      )
    }

    // Contar total de hijos
    const totalHijos = await prisma.bovino.count({
      where: {
        OR: [
          { padreId: id },
          { madreId: id },
        ],
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...bovino,
        totalHijos,
      },
    })
  } catch (error) {
    console.error("Error al obtener genealogía:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

