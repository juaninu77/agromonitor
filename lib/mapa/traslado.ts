// Traslado de animales entre campos (establecimientos) de la misma organización.
// En una sola transacción: cambia el campo del animal, cierra su ubicación y su
// grupo de origen, lo ubica en el lugar de destino (y opcionalmente en un grupo
// del destino), registra el movimiento con el número de DTe y mantiene la
// rotación coherente en origen y destino. Mover entre organizaciones es una
// venta (baja), no un traslado.

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { mapField, MapError } from "./api"
import { actualizarPastoreos } from "./move"
import { livestockTypes } from "./sector-state"

export const trasladoSchema = z.object({
  animalIds: z.array(z.string().uuid()).min(1, "Elegí al menos un animal").max(500),
  origenSectorId: z.string().uuid().optional(),
  destinoSectorId: z.string().uuid({ message: "Elegí el lugar de destino" }),
  loteDestinoId: z.string().uuid().nullish(),
  dte: z.string().trim().max(40).nullish().transform((v) => v || null),
  motivo: z.string().trim().max(500).nullish().transform((v) => v || null),
}).strict()

export type TrasladoInput = z.infer<typeof trasladoSchema>

export async function trasladarAnimales(raw: unknown, ctx: AuthContext) {
  const v = trasladoSchema.parse(raw)
  return prisma.$transaction(async (tx) => {
    const destino = await tx.sector.findFirst({ where: { id: v.destinoSectorId, establecimientoId: { in: ctx.establecimientoIds }, activo: true } })
    if (!destino) throw new MapError("Lugar de destino no encontrado", 404)
    mapField(ctx, destino.establecimientoId, true)
    if (!livestockTypes.has(destino.tipo)) throw new MapError("El lugar de destino no admite hacienda")

    const ids = [...new Set(v.animalIds)]
    const animales = await tx.animal.findMany({
      where: { id: { in: ids }, estadoVital: "activo", establecimientoId: { in: ctx.establecimientoIds } },
      include: { ubicacionHist: { where: { hasta: null } }, loteHist: { where: { hasta: null } } },
    })
    if (animales.length !== ids.length) throw new MapError("Algunos animales no existen, no están activos o no son de tus campos", 404)
    const origenes = [...new Set(animales.map((a) => a.establecimientoId!))]
    for (const o of origenes) mapField(ctx, o, true)
    if (origenes.includes(destino.establecimientoId)) {
      throw new MapError("Los animales ya están en ese campo: usá «Mover animales» para cambiarlos de lugar")
    }
    const orgDestino = ctx.organizacionDeEstablecimiento[destino.establecimientoId]
    if (origenes.some((o) => ctx.organizacionDeEstablecimiento[o] !== orgDestino)) {
      throw new MapError("Solo se puede trasladar entre campos de la misma organización. Para otra organización registrá una venta.")
    }
    if (v.origenSectorId && animales.some((a) => a.ubicacionHist[0]?.sectorId !== v.origenSectorId)) {
      throw new MapError("La ubicación cambió. Actualizá la ficha antes de trasladar", 409)
    }

    // La caravana visual es única por campo: no puede repetirse en el destino
    const visuales = animales.map((a) => a.caravanaVisual).filter((c): c is string => !!c)
    if (visuales.length) {
      const repetidas = await tx.animal.findMany({ where: { establecimientoId: destino.establecimientoId, caravanaVisual: { in: visuales } }, select: { caravanaVisual: true } })
      if (repetidas.length) {
        throw new MapError(`En el campo de destino ya existen las caravanas ${repetidas.map((r) => r.caravanaVisual).slice(0, 5).join(", ")}${repetidas.length > 5 ? "…" : ""}. Cambiá la caravana visual antes de trasladar.`, 409)
      }
    }

    const lote = v.loteDestinoId
      ? await tx.lote.findFirst({ where: { id: v.loteDestinoId, establecimientoId: destino.establecimientoId, activo: true } })
      : null
    if (v.loteDestinoId && !lote) throw new MapError("El grupo de destino no pertenece a ese campo o está inactivo", 400)
    if (lote && animales.some((a) => a.especieId !== lote.especieId)) throw new MapError("El grupo de destino es de otra especie")

    const ahora = new Date()
    if (animales.some((a) => a.ubicacionHist.some((u) => u.desde > ahora) || a.loteHist.some((l) => l.desde > ahora))) {
      throw new MapError("Hay ubicaciones o grupos con fecha futura. Revisá el historial antes de trasladar", 409)
    }
    const motivo = [v.motivo ?? "Traslado entre campos", v.dte ? `DTe ${v.dte}` : null].filter(Boolean).join(" · ")
    const idsMovidos = animales.map((a) => a.id)
    const lotesOrigen = [...new Set(animales.flatMap((a) => a.loteHist.map((l) => l.loteId)))]

    // Origen: cerrar ubicación y grupo actuales
    await tx.ubicacionHist.updateMany({ where: { animalId: { in: idsMovidos }, hasta: null }, data: { hasta: ahora } })
    await tx.animalLoteHist.updateMany({ where: { animalId: { in: idsMovidos }, hasta: null }, data: { hasta: ahora } })
    // Cambio de campo
    await tx.animal.updateMany({ where: { id: { in: idsMovidos } }, data: { establecimientoId: destino.establecimientoId } })
    // Destino: ubicación, grupo y evento de movimiento
    await tx.ubicacionHist.createMany({ data: idsMovidos.map((animalId) => ({ animalId, sectorId: destino.id, desde: ahora, motivo })) })
    if (lote) await tx.animalLoteHist.createMany({ data: idsMovidos.map((animalId) => ({ animalId, loteId: lote.id, desde: ahora, motivo })) })
    await tx.evtMovimiento.createMany({
      data: animales.map((a) => ({ animalId: a.id, origenSectorId: a.ubicacionHist[0]?.sectorId ?? null, destinoSectorId: destino.id, fecha: ahora, motivo, cantidadAnimales: 1 })),
    })

    // Rotación: cerrar pastoreos de los grupos de origen que quedaron vacíos
    if (lotesOrigen.length) {
      const abiertos = await tx.evtPastoreo.findMany({ where: { loteId: { in: lotesOrigen }, egreso: null }, select: { id: true, loteId: true, sectorId: true } })
      for (const p of abiertos) {
        const quedan = await tx.ubicacionHist.count({ where: { sectorId: p.sectorId, hasta: null, animal: { estadoVital: "activo", loteHist: { some: { loteId: p.loteId, hasta: null } } } } })
        if (quedan === 0) await tx.evtPastoreo.update({ where: { id: p.id }, data: { egreso: ahora } })
      }
    }
    // y abrir en destino si el grupo quedó completo en la parcela
    if (lote) await actualizarPastoreos(tx, idsMovidos, destino, lote.id, ahora, motivo)

    await tx.auditLog.create({
      data: {
        usuarioId: ctx.userId,
        organizacionId: orgDestino,
        tabla: "traslados_campo",
        rowPk: destino.id,
        accion: "INSERT",
        detalle: { animalIds: idsMovidos, origenes, destinoEstablecimientoId: destino.establecimientoId, destinoSectorId: destino.id, loteDestinoId: lote?.id ?? null, dte: v.dte },
      },
    })
    return { trasladados: idsMovidos.length, destino: destino.nombre, establecimientoId: destino.establecimientoId }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 })
}
