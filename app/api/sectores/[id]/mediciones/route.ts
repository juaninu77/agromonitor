import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { id: sectorId } = await params

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const [mediciones, total] = await Promise.all([
      prisma.medicionPotrero.findMany({
        where: { sectorId },
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      prisma.medicionPotrero.count({ where: { sectorId } }),
    ])

    return NextResponse.json({
      success: true,
      data: mediciones,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error al obtener mediciones:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { id: sectorId } = await params
    const body = await request.json()

    const sector = await prisma.sector.findUnique({
      where: { id: sectorId },
    })

    if (!sector) {
      return NextResponse.json(
        { error: "Sector no encontrado" },
        { status: 404 }
      )
    }

    const medicion = await prisma.medicionPotrero.create({
      data: {
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        alturaPastoCm: body.alturaPastoCm
          ? parseFloat(body.alturaPastoCm)
          : null,
        msKgHa: body.msKgHa ? parseFloat(body.msKgHa) : null,
        coberturaPct: body.coberturaPct
          ? parseFloat(body.coberturaPct)
          : null,
        observ: body.observ || null,
        sectorId,
      },
    })

    return NextResponse.json(
      { success: true, data: medicion },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error al crear medición:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
