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

    const { id } = await params

    const animal = await prisma.animal.findUnique({
      where: { id },
      include: {
        especie: true,
        raza: true,
        categoria: true,
        genealogia: true,
      },
    })

    if (!animal) {
      return NextResponse.json({ error: "Animal no encontrado" }, { status: 404 })
    }

    let padre = null
    let madre = null

    if (animal.genealogia?.padreId) {
      padre = await prisma.animal.findUnique({
        where: { id: animal.genealogia.padreId },
        include: {
          raza: true,
          categoria: true,
          genealogia: true,
        },
      })
    }

    if (animal.genealogia?.madreId) {
      madre = await prisma.animal.findUnique({
        where: { id: animal.genealogia.madreId },
        include: {
          raza: true,
          categoria: true,
          genealogia: true,
        },
      })
    }

    const totalHijosComoPadre = await prisma.genealogia.count({
      where: { padreId: id },
    })
    const totalHijosComoMadre = await prisma.genealogia.count({
      where: { madreId: id },
    })

    return NextResponse.json({
      success: true,
      data: {
        animal: {
          id: animal.id,
          caravanaVisual: animal.caravanaVisual,
          sexo: animal.sexo,
          raza: animal.raza?.nombre,
          categoria: animal.categoria?.nombre,
        },
        padre: padre
          ? {
              id: padre.id,
              caravanaVisual: padre.caravanaVisual,
              raza: padre.raza?.nombre,
              padreExterno: animal.genealogia?.padreExterno,
            }
          : { padreExterno: animal.genealogia?.padreExterno || null },
        madre: madre
          ? {
              id: madre.id,
              caravanaVisual: madre.caravanaVisual,
              raza: madre.raza?.nombre,
              madreExterno: animal.genealogia?.madreExterno,
            }
          : { madreExterno: animal.genealogia?.madreExterno || null },
        totalHijos: totalHijosComoPadre + totalHijosComoMadre,
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
