import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { loteDelTenant } from "@/lib/api/tenant"
import { prisma } from "@/lib/prisma"

const movimientoSchema = z.object({
  animalIds: z.array(z.string().uuid()).min(1, "Seleccioná al menos un animal")
    .max(500).transform((ids) => [...new Set(ids)]),
  loteDestinoId: z.string().uuid("Lote destino inválido"),
  fecha: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Fecha inválida").optional(),
  motivo: z.string().optional(),
})

export const POST = withAuth(async (request, ctx) => {
  try {
    const body = await request.json()
    const parsed = movimientoSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { animalIds, loteDestinoId, fecha, motivo } = parsed.data
    const fechaMov = fecha ? new Date(fecha) : new Date()

    const loteDestino = await loteDelTenant(loteDestinoId, ctx.establecimientoIds)

    if (!loteDestino) {
      return NextResponse.json({ error: "Lote destino no encontrado" }, { status: 404 })
    }

    // Validar que todos los animales pertenezcan al tenant
    const animalesDelTenant = await prisma.animal.findMany({
      where: {
        id: { in: animalIds },
        establecimientoId: { in: ctx.establecimientoIds },
      },
      select: { id: true, establecimientoId: true, especieId: true },
    })

    if (animalesDelTenant.length !== animalIds.length) {
      return NextResponse.json(
        { error: "Uno o más animales no encontrados" },
        { status: 404 }
      )
    }

    if (animalesDelTenant.some((animal) => animal.establecimientoId !== loteDestino.establecimientoId)) {
      return NextResponse.json(
        { error: "El lote y los animales deben pertenecer al mismo establecimiento" },
        { status: 400 }
      )
    }

    if (animalesDelTenant.some(animal => animal.especieId !== loteDestino.especieId)) {
      return NextResponse.json({ error: "El lote debe corresponder a la especie de todos los animales" }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const posteriores = await tx.animalLoteHist.count({
        where: { animalId: { in: animalIds }, desde: { gt: fechaMov } },
      })
      if (posteriores > 0) return null
      let moved = 0

      for (const animalId of animalIds) {
        await tx.animalLoteHist.updateMany({
          where: { animalId, hasta: null },
          data: { hasta: fechaMov },
        })

        await tx.animalLoteHist.create({
          data: {
            animalId,
            loteId: loteDestinoId,
            desde: fechaMov,
            motivo: motivo ?? null,
          },
        })

        moved++
      }

      return { moved }
    })

    if (!result) {
      return NextResponse.json(
        { error: "La fecha no puede ser anterior a movimientos ya registrados" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        moved: result.moved,
        loteDestino: loteDestino.nombre,
      },
    })
  } catch (error) {
    console.error("Error al mover animales:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
