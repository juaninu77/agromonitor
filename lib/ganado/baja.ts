// Servicio de baja de animales, compartido por DELETE /api/ganado/bovinos/[id]
// y POST /api/ventas/bajas. La baja es un evento (EvtBaja), no un borrado:
// deja el estadoVital que corresponde al motivo y cierra los historiales
// abiertos de lote y ubicación para que el animal deje de contar en el rodeo.

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { ESTADO_VITAL_POR_MOTIVO, type BajaInput } from "@/lib/validations/eventos-schema"

export class BajaError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

interface ContextoBaja {
  /** Establecimientos donde el usuario puede dar de baja (rol admin/encargado). */
  establecimientoIds: string[]
  /** Organizaciones accesibles, para validar el cliente de una venta. */
  organizacionIds: string[]
}

/**
 * Registra la baja de un animal en una transacción: crea el EvtBaja, actualiza
 * el estado vital según el motivo y cierra los historiales abiertos. Rechaza
 * animales ajenos, ya dados de baja o con eventos posteriores a la fecha.
 */
export async function registrarBaja(input: BajaInput, ctx: ContextoBaja) {
  const animal = await prisma.animal.findFirst({
    where: { id: input.animalId, establecimientoId: { in: ctx.establecimientoIds } },
    select: { id: true, estadoVital: true, establecimientoId: true, caravanaVisual: true },
  })
  if (!animal) throw new BajaError("Animal no encontrado", 404)
  if (animal.estadoVital !== "activo") {
    throw new BajaError("El animal ya tiene una baja registrada o no está activo", 400)
  }

  if (input.clienteId) {
    const cliente = await prisma.cliente.findFirst({
      where: { id: input.clienteId, organizacionId: { in: ctx.organizacionIds } },
      select: { id: true },
    })
    if (!cliente) throw new BajaError("El cliente no pertenece a tu organización", 403)
  }

  // No se puede dar de baja antes de un evento ya registrado
  const posteriores = await prisma.evtPesada.count({ where: { animalId: animal.id, fecha: { gt: input.fecha } } })
  if (posteriores > 0) {
    throw new BajaError("La fecha de baja no puede ser anterior a eventos ya registrados del animal", 400)
  }

  const estadoVital = ESTADO_VITAL_POR_MOTIVO[input.motivo]

  return prisma.$transaction(async (tx) => {
    const baja = await tx.evtBaja.create({
      data: {
        fecha: input.fecha,
        motivo: input.motivo,
        pesoVivoKg: input.pesoVivoKg ?? null,
        precioKg: input.precioKg ?? null,
        precioTotal: input.precioTotal ?? null,
        dtaNumero: input.dtaNumero ?? null,
        facturaNumero: input.facturaNumero ?? null,
        observ: input.observ ?? null,
        animalId: animal.id,
        clienteId: input.clienteId ?? null,
      },
      include: {
        animal: { include: { raza: true, categoria: true } },
        cliente: true,
      },
    })

    // Si la baja tiene peso vivo, queda también como última pesada del animal
    if (input.pesoVivoKg) {
      await tx.evtPesada.create({
        data: { animalId: animal.id, fecha: input.fecha, pesoKg: input.pesoVivoKg, observ: `Peso de baja (${input.motivo})` },
      })
    }

    await tx.animalLoteHist.updateMany({ where: { animalId: animal.id, hasta: null }, data: { hasta: input.fecha } })
    await tx.ubicacionHist.updateMany({ where: { animalId: animal.id, hasta: null }, data: { hasta: input.fecha } })

    await tx.animal.update({ where: { id: animal.id }, data: { estadoVital } })

    return { baja, animal: { ...animal, estadoVital } }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}
