// Pesadas y movimientos de grupo: la única escritura de estos eventos, usada por las
// rutas de la web (POST /api/ganado/pesos y /api/ganado/movimiento-lote) y por el
// asistente de WhatsApp. Reciben los datos ya validados con lib/validations/eventos-schema.ts.

import type { AuthContext } from "@/lib/api/with-auth"
import { animalDelTenant, loteDelTenant } from "@/lib/api/tenant"
import { logAudit } from "@/lib/api/audit-log"
import { prisma } from "@/lib/prisma"
import type { MovimientoLoteInput, PesadaInput } from "@/lib/validations/eventos-schema"

export class EventoGanadoError extends Error {
  constructor(message: string, public status = 400, public codigo?: string) {
    super(message)
  }
}

type ContextoEvento = Pick<AuthContext, "userId" | "establecimientoIds" | "organizacionDeEstablecimiento">

/**
 * Registra una o varias pesadas (todas o ninguna). Cualquier rol del campo puede pesar
 * (es trabajo de campo), pero cada animal debe estar activo.
 */
export async function registrarPesadas(ctx: ContextoEvento, pesadas: PesadaInput[]) {
  if (new Set(pesadas.map((p) => p.animalId)).size !== pesadas.length) throw new EventoGanadoError("Hay un animal repetido en las pesadas")
  const animales = []
  for (const p of pesadas) {
    const animal = await animalDelTenant(p.animalId, ctx.establecimientoIds)
    if (!animal) throw new EventoGanadoError("Animal no encontrado", 404)
    if (animal.estadoVital !== "activo") throw new EventoGanadoError("No se pueden registrar pesadas de un animal dado de baja")
    animales.push(animal)
  }

  const crear = (p: PesadaInput) =>
    prisma.evtPesada.create({
      data: { animalId: p.animalId, pesoKg: p.peso, cc: p.cc ?? null, fecha: p.fecha, observ: p.notas ?? null, balanza: p.balanza ?? null },
    })
  const creadas = pesadas.length === 1 ? [await crear(pesadas[0])] : await prisma.$transaction(pesadas.map(crear))

  for (const [i, pesada] of creadas.entries()) {
    const p = pesadas[i], est = animales[i].establecimientoId
    await logAudit({
      userId: ctx.userId,
      tabla: "evt_pesada",
      rowPk: pesada.id,
      accion: "INSERT",
      detalle: { animalId: p.animalId, pesoKg: p.peso, cc: p.cc ?? null },
      organizacionId: est ? ctx.organizacionDeEstablecimiento[est] : null,
    })
  }
  return creadas
}

export const ROLES_MOVIMIENTO = ["admin", "encargado"] as const

/**
 * Mueve animales a un grupo del mismo campo y especie. Solo admin o encargado del campo;
 * animales activos; la fecha no puede ser anterior a movimientos ya registrados. Los que
 * ya están en el grupo destino se omiten.
 */
export async function moverDeLote(ctx: ContextoEvento & Pick<AuthContext, "establecimientoIdsConRol">, input: MovimientoLoteInput) {
  const { animalIds, loteDestinoId, fecha, motivo } = input
  const fechaMov = fecha ?? new Date()

  // El lote destino debe estar en un campo donde el usuario pueda mover hacienda
  const establecimientosPermitidos = ctx.establecimientoIdsConRol([...ROLES_MOVIMIENTO])
  const loteDestino = await loteDelTenant(loteDestinoId, establecimientosPermitidos)
  if (!loteDestino) throw new EventoGanadoError("Lote destino no encontrado", 404)
  if (!loteDestino.activo) throw new EventoGanadoError("El lote destino está inactivo")

  const animales = await prisma.animal.findMany({
    where: { id: { in: animalIds }, establecimientoId: { in: establecimientosPermitidos } },
    select: { id: true, establecimientoId: true, especieId: true, estadoVital: true },
  })
  if (animales.length !== animalIds.length) throw new EventoGanadoError("Uno o más animales no encontrados", 404)
  if (animales.some((a) => a.estadoVital !== "activo")) throw new EventoGanadoError("No se pueden mover animales dados de baja")
  if (animales.some((a) => a.establecimientoId !== loteDestino.establecimientoId)) {
    throw new EventoGanadoError("El lote y los animales deben pertenecer al mismo establecimiento")
  }
  if (animales.some((a) => a.especieId !== loteDestino.especieId)) {
    throw new EventoGanadoError("El lote debe corresponder a la especie de todos los animales")
  }

  const result = await prisma.$transaction(async (tx) => {
    const posteriores = await tx.animalLoteHist.count({ where: { animalId: { in: animalIds }, desde: { gt: fechaMov } } })
    if (posteriores > 0) return null

    // Los que ya están en el lote destino no se mueven
    const abiertos = await tx.animalLoteHist.findMany({
      where: { animalId: { in: animalIds }, hasta: null },
      select: { animalId: true, loteId: true },
    })
    const yaEnDestino = new Set(abiertos.filter((h) => h.loteId === loteDestinoId).map((h) => h.animalId))
    const aMover = animalIds.filter((id) => !yaEnDestino.has(id))

    if (aMover.length > 0) {
      await tx.animalLoteHist.updateMany({ where: { animalId: { in: aMover }, hasta: null }, data: { hasta: fechaMov } })
      await tx.animalLoteHist.createMany({
        data: aMover.map((animalId) => ({ animalId, loteId: loteDestinoId, desde: fechaMov, motivo: motivo ?? null })),
      })
    }
    return { moved: aMover.length, omitidos: yaEnDestino.size }
  })
  if (!result) throw new EventoGanadoError("La fecha no puede ser anterior a movimientos ya registrados")

  await logAudit({
    userId: ctx.userId,
    tabla: "animal_lote_hist",
    rowPk: loteDestinoId,
    accion: "INSERT",
    detalle: { animalIds, loteDestinoId, movidos: result.moved, omitidos: result.omitidos, motivo: motivo ?? null },
    organizacionId: ctx.organizacionDeEstablecimiento[loteDestino.establecimientoId] ?? null,
  })
  return { ...result, loteDestino: loteDestino.nombre }
}
