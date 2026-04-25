import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const establecimientoId = searchParams.get("establecimientoId")

    const especieOvina = await prisma.especie.findFirst({
      where: { nombre: { contains: "ovin", mode: "insensitive" } },
    })

    if (!especieOvina) {
      return NextResponse.json({
        success: true,
        data: [],
        stats: { total: 0, pesoPromedio: 0 },
      })
    }

    const where: any = {
      especieId: especieOvina.id,
      estadoVital: "activo",
    }

    if (establecimientoId) {
      where.loteHist = {
        some: {
          hasta: null,
          lote: { establecimientoId },
        },
      }
    }

    const ovinos = await prisma.animal.findMany({
      where,
      include: {
        raza: true,
        categoria: true,
      },
      orderBy: { caravanaVisual: "asc" },
    })

    return NextResponse.json({
      success: true,
      data: ovinos,
      stats: {
        total: ovinos.length,
      },
    })
  } catch (error) {
    console.error("Error al obtener ovinos:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
