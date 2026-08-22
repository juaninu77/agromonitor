import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"

export const GET = withAuth(async (request, ctx) => {
  try {
    const { id } = ctx.params

    const animal = await prisma.animal.findFirst({
      where: { id, establecimientoId: { in: ctx.establecimientoIds } },
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

    // Padres/madres: solo si también pertenecen al tenant
    if (animal.genealogia?.padreId) {
      padre = await prisma.animal.findFirst({
        where: {
          id: animal.genealogia.padreId,
          establecimientoId: { in: ctx.establecimientoIds },
        },
        include: {
          raza: true,
          categoria: true,
          genealogia: true,
        },
      })
    }

    if (animal.genealogia?.madreId) {
      madre = await prisma.animal.findFirst({
        where: {
          id: animal.genealogia.madreId,
          establecimientoId: { in: ctx.establecimientoIds },
        },
        include: {
          raza: true,
          categoria: true,
          genealogia: true,
        },
      })
    }

    const totalHijosComoPadre = await prisma.genealogia.count({
      where: {
        padreId: id,
        animal: { establecimientoId: { in: ctx.establecimientoIds } },
      },
    })
    const totalHijosComoMadre = await prisma.genealogia.count({
      where: {
        madreId: id,
        animal: { establecimientoId: { in: ctx.establecimientoIds } },
      },
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
})
