import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { loteDelTenant } from "@/lib/api/tenant"
import { logAudit } from "@/lib/api/audit-log"
import { prisma } from "@/lib/prisma"
import { erroresZod } from "@/lib/ganado/alta"
import { movimientoLoteSchema } from "@/lib/validations/eventos-schema"

// ============================================
// POST /api/ganado/movimiento-lote
// ============================================
// Mueve animales entre lotes del mismo establecimiento. Sólo admin o
// encargado de la organización dueña del lote; animales activos; la fecha
// no puede ser futura ni anterior a movimientos ya registrados.

const ROLES_MOVIMIENTO = ["admin", "encargado"] as const

export const POST = withAuth(
  async (request, ctx) => {
    try {
      const parsed = movimientoLoteSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) {
        const errores = erroresZod(parsed.error)
        return NextResponse.json(
          { success: false, error: errores[0], errores, details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )
      }

      const { animalIds, loteDestinoId, fecha, motivo } = parsed.data
      const fechaMov = fecha ?? new Date()

      // El lote destino debe estar en un campo donde el usuario pueda mover hacienda
      const establecimientosPermitidos = ctx.establecimientoIdsConRol([...ROLES_MOVIMIENTO])
      const loteDestino = await loteDelTenant(loteDestinoId, establecimientosPermitidos)
      if (!loteDestino) {
        return NextResponse.json({ success: false, error: "Lote destino no encontrado" }, { status: 404 })
      }
      if (!loteDestino.activo) {
        return NextResponse.json({ success: false, error: "El lote destino está inactivo" }, { status: 400 })
      }

      const animales = await prisma.animal.findMany({
        where: { id: { in: animalIds }, establecimientoId: { in: establecimientosPermitidos } },
        select: { id: true, establecimientoId: true, especieId: true, estadoVital: true },
      })

      if (animales.length !== animalIds.length) {
        return NextResponse.json({ success: false, error: "Uno o más animales no encontrados" }, { status: 404 })
      }
      if (animales.some((a) => a.estadoVital !== "activo")) {
        return NextResponse.json(
          { success: false, error: "No se pueden mover animales dados de baja" },
          { status: 400 }
        )
      }
      if (animales.some((a) => a.establecimientoId !== loteDestino.establecimientoId)) {
        return NextResponse.json(
          { success: false, error: "El lote y los animales deben pertenecer al mismo establecimiento" },
          { status: 400 }
        )
      }
      if (animales.some((a) => a.especieId !== loteDestino.especieId)) {
        return NextResponse.json(
          { success: false, error: "El lote debe corresponder a la especie de todos los animales" },
          { status: 400 }
        )
      }

      const result = await prisma.$transaction(async (tx) => {
        const posteriores = await tx.animalLoteHist.count({
          where: { animalId: { in: animalIds }, desde: { gt: fechaMov } },
        })
        if (posteriores > 0) return null

        // Los que ya están en el lote destino no se mueven
        const abiertos = await tx.animalLoteHist.findMany({
          where: { animalId: { in: animalIds }, hasta: null },
          select: { animalId: true, loteId: true },
        })
        const yaEnDestino = new Set(abiertos.filter((h) => h.loteId === loteDestinoId).map((h) => h.animalId))
        const aMover = animalIds.filter((id) => !yaEnDestino.has(id))

        if (aMover.length > 0) {
          await tx.animalLoteHist.updateMany({
            where: { animalId: { in: aMover }, hasta: null },
            data: { hasta: fechaMov },
          })
          await tx.animalLoteHist.createMany({
            data: aMover.map((animalId) => ({ animalId, loteId: loteDestinoId, desde: fechaMov, motivo: motivo ?? null })),
          })
        }

        return { moved: aMover.length, omitidos: yaEnDestino.size }
      })

      if (!result) {
        return NextResponse.json(
          { success: false, error: "La fecha no puede ser anterior a movimientos ya registrados" },
          { status: 400 }
        )
      }

      await logAudit({
        userId: ctx.userId,
        tabla: "animal_lote_hist",
        rowPk: loteDestinoId,
        accion: "INSERT",
        detalle: { animalIds, loteDestinoId, movidos: result.moved, omitidos: result.omitidos, motivo: motivo ?? null },
        organizacionId: ctx.organizacionDeEstablecimiento[loteDestino.establecimientoId] ?? null,
      })

      return NextResponse.json({
        success: true,
        data: { moved: result.moved, omitidos: result.omitidos, loteDestino: loteDestino.nombre },
      })
    } catch (error) {
      console.error("Error al mover animales:", error)
      return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
    }
  },
  { roles: [...ROLES_MOVIMIENTO] }
)
