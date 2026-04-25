import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const especieId = searchParams.get("especieId")
    const especieNombre = searchParams.get("especie")

    // Construir filtros
    const where: Record<string, unknown> = {}

    if (especieId) {
      where.especieId = especieId
    } else if (especieNombre) {
      // Buscar la especie por nombre
      const especie = await prisma.especie.findFirst({
        where: { nombre: especieNombre.toLowerCase() }
      })
      if (especie) {
        where.especieId = especie.id
      }
    }

    const categorias = await prisma.categoria.findMany({
      where: where as any,
      orderBy: { nombre: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: categorias,
    })
  } catch (error) {
    console.error("Error al obtener categorías:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
