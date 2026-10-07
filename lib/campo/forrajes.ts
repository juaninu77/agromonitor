// Forraje trazable: cosechas, consumos y transferencias entre galpones.
// El saldo de una reserva solo cambia con movimientos (entrada/salida); cada
// movimiento guarda de qué campaña salió (cosecha), dónde y a qué grupo se dio
// (consumo) o cuál es su otra pata (transferencia). Fardos, rollos y kg nunca
// se convierten entre sí. Una clave de operación hace idempotentes los reintentos.

import { randomUUID } from "node:crypto"
import { Prisma, type MovimientoForraje, type ReservaForraje } from "@prisma/client"
import type { z } from "zod"
import type { AuthContext } from "@/lib/api/with-auth"
import { livestockTypes } from "@/lib/mapa/sector-state"
import { CONCEPTO_FORRAJE_LABEL, cosechaSchema, movimientoSchema, transferenciaForrajeSchema } from "./rules"

export class InputError extends Error { constructor(message: string, public status = 400) { super(message) } }

type Tx = Prisma.TransactionClient
const iso = (v: string) => new Date(`${v}T00:00:00Z`)
const mismaFecha = (d: Date, v: string) => d.toISOString().slice(0, 10) === v

async function audit(tx: Tx, ctx: AuthContext, campoId: string, id: string, tabla: string) {
  await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[campoId], tabla, rowPk: id, accion: "INSERT" } })
}

function validarCantidad(reserva: Pick<ReservaForraje, "unidad">, cantidad: string) {
  if (reserva.unidad !== "kg" && !new Prisma.Decimal(cantidad).isInteger()) throw new InputError("Fardos y rollos se registran en unidades enteras")
}

/** Suma o descuenta stock sin dejarlo negativo (la condición va en el UPDATE, a prueba de concurrencia). */
async function aplicar(tx: Tx, campoId: string, reservaId: string, tipo: "entrada" | "salida", cantidad: string) {
  const changed = await tx.reservaForraje.updateMany({
    where: { id: reservaId, establecimientoId: campoId, ...(tipo === "salida" ? { stock: { gte: cantidad } } : {}) },
    data: { stock: tipo === "entrada" ? { increment: cantidad } : { decrement: cantidad } },
  })
  if (!changed.count) throw new InputError("Stock insuficiente: no se registró la salida", 409)
}

/** Reintento de una operación ya registrada: devuelve la original o 409 si los datos difieren. */
function repetida(prior: MovimientoForraje, igual: boolean) {
  if (!igual) throw new InputError("La clave de operación ya fue utilizada con otros datos", 409)
  return prior
}

// ------------------------------------------------------------
// Entrada / salida simple (compra, consumo, venta, ajuste)
// ------------------------------------------------------------

export async function registrarMovimiento(tx: Tx, ctx: AuthContext, campoId: string, raw: unknown) {
  const v = movimientoSchema.parse(raw)
  const reserva = await tx.reservaForraje.findFirst({ where: { id: v.reservaId, establecimientoId: campoId } })
  if (!reserva) throw new InputError("Reserva no encontrada", 404)
  validarCantidad(reserva, v.cantidad)
  const motivo = v.motivo || CONCEPTO_FORRAJE_LABEL[v.concepto!]
  const prior = await tx.movimientoForraje.findUnique({ where: { clave: v.clave } })
  if (prior) {
    return repetida(prior, prior.reservaId === v.reservaId && prior.tipo === v.tipo && prior.cantidad.equals(v.cantidad) && mismaFecha(prior.fecha, v.fecha)
      && prior.motivo === motivo && prior.concepto === v.concepto && prior.sectorId === v.sectorId && prior.loteId === v.loteId)
  }
  if (v.sectorId) {
    const s = await tx.sector.findFirst({ where: { id: v.sectorId, establecimientoId: campoId, activo: true }, select: { tipo: true } })
    if (!s) throw new InputError("El potrero del consumo no pertenece a este campo", 404)
    if (!livestockTypes.has(s.tipo)) throw new InputError("El consumo se registra en un potrero, corral o feedlot")
  }
  if (v.loteId && !await tx.lote.findFirst({ where: { id: v.loteId, establecimientoId: campoId, activo: true }, select: { id: true } })) {
    throw new InputError("El grupo alimentado no pertenece a este campo", 404)
  }
  await aplicar(tx, campoId, v.reservaId, v.tipo, v.cantidad)
  const row = await tx.movimientoForraje.create({
    data: { reservaId: v.reservaId, clave: v.clave, tipo: v.tipo, cantidad: v.cantidad, fecha: iso(v.fecha), motivo, concepto: v.concepto, sectorId: v.sectorId, loteId: v.loteId },
  })
  await audit(tx, ctx, campoId, row.id, "movimientos_forraje")
  return row
}

// ------------------------------------------------------------
// Cosecha de una campaña → entrada a una reserva (existente o nueva)
// ------------------------------------------------------------

export async function registrarCosecha(tx: Tx, ctx: AuthContext, campoId: string, raw: unknown) {
  const v: z.infer<typeof cosechaSchema> = cosechaSchema.parse(raw)
  const prior = await tx.movimientoForraje.findUnique({ where: { clave: v.clave } })
  if (prior) {
    return repetida(prior, prior.concepto === "cosecha" && prior.cultivoId === v.cultivoId && prior.cantidad.equals(v.cantidad) && mismaFecha(prior.fecha, v.fecha)
      && (!v.reservaId || prior.reservaId === v.reservaId))
  }
  const cultivo = await tx.sectorForraje.findFirst({ where: { id: v.cultivoId, sector: { establecimientoId: campoId } }, include: { sector: { select: { nombre: true } }, forraje: { select: { nombre: true } } } })
  if (!cultivo) throw new InputError("Campaña no encontrada en este campo", 404)
  if (iso(v.fecha) < cultivo.desde) throw new InputError("La cosecha no puede ser anterior a la siembra")
  if (cultivo.hasta && iso(v.fecha) > cultivo.hasta) throw new InputError("La campaña ya estaba cerrada en esa fecha")

  let reserva: ReservaForraje
  if (v.reservaId) {
    const r = await tx.reservaForraje.findFirst({ where: { id: v.reservaId, establecimientoId: campoId } })
    if (!r) throw new InputError("Reserva no encontrada", 404)
    if (r.forrajeId !== cultivo.forrajeId) throw new InputError("La reserva es de otro forraje que la campaña")
    reserva = r
  } else {
    const deposito = v.depositoId ? await tx.sector.findFirst({ where: { id: v.depositoId, establecimientoId: campoId, tipo: "galpon", activo: true } }) : null
    if (v.depositoId && !deposito) throw new InputError("Galpón no encontrado en este campo")
    // Se crea con saldo cero: la entrada de la cosecha es la que suma el stock
    reserva = await tx.reservaForraje.create({
      data: { establecimientoId: campoId, forrajeId: cultivo.forrajeId, cultivoId: cultivo.id, depositoId: deposito?.id ?? null, nombre: v.nombre!, unidad: v.unidad!, ubicacion: deposito?.nombre ?? cultivo.sector.nombre, minimo: v.minimo },
    })
    await audit(tx, ctx, campoId, reserva.id, "reservas_forraje")
  }
  validarCantidad(reserva, v.cantidad)
  await aplicar(tx, campoId, reserva.id, "entrada", v.cantidad)
  const row = await tx.movimientoForraje.create({
    data: { reservaId: reserva.id, clave: v.clave, tipo: "entrada", concepto: "cosecha", cultivoId: cultivo.id, cantidad: v.cantidad, fecha: iso(v.fecha), motivo: v.motivo || `Cosecha de ${cultivo.forraje.nombre} en ${cultivo.sector.nombre}` },
  })
  await audit(tx, ctx, campoId, row.id, "movimientos_forraje")
  return row
}

// ------------------------------------------------------------
// Transferencia entre galpones: salida + entrada atómicas
// ------------------------------------------------------------

export async function transferirForraje(tx: Tx, ctx: AuthContext, campoId: string, raw: unknown) {
  const v = transferenciaForrajeSchema.parse(raw)
  const prior = await tx.movimientoForraje.findUnique({ where: { clave: v.clave } })
  if (prior) {
    repetida(prior, prior.concepto === "transferencia" && prior.tipo === "salida" && prior.reservaId === v.reservaId && prior.cantidad.equals(v.cantidad) && mismaFecha(prior.fecha, v.fecha))
    const otra = prior.transferenciaId ? await tx.movimientoForraje.findFirst({ where: { transferenciaId: prior.transferenciaId, tipo: "entrada" }, select: { reservaId: true } }) : null
    return { ...prior, reservaDestinoId: otra?.reservaId ?? null }
  }
  const origen = await tx.reservaForraje.findFirst({ where: { id: v.reservaId, establecimientoId: campoId }, include: { deposito: { select: { nombre: true } } } })
  if (!origen) throw new InputError("Reserva no encontrada", 404)
  const galpon = await tx.sector.findFirst({ where: { id: v.depositoDestinoId, establecimientoId: campoId, tipo: "galpon", activo: true } })
  if (!galpon) throw new InputError("Galpón de destino no encontrado en este campo", 404)
  if (galpon.id === origen.depositoId) throw new InputError("La reserva ya está en ese galpón")
  validarCantidad(origen, v.cantidad)

  // En destino se suma a una reserva del mismo forraje y unidad (preferentemente de la misma campaña) o se crea una
  const candidatas = await tx.reservaForraje.findMany({ where: { establecimientoId: campoId, depositoId: galpon.id, forrajeId: origen.forrajeId, unidad: origen.unidad }, orderBy: { createdAt: "asc" } })
  let destino = candidatas.find((r) => r.cultivoId === origen.cultivoId) ?? candidatas[0]
  if (!destino) {
    destino = await tx.reservaForraje.create({
      data: { establecimientoId: campoId, forrajeId: origen.forrajeId, cultivoId: origen.cultivoId, depositoId: galpon.id, nombre: origen.nombre, unidad: origen.unidad, ubicacion: galpon.nombre, minimo: 0 },
    })
    await audit(tx, ctx, campoId, destino.id, "reservas_forraje")
  }
  const transferenciaId = randomUUID(), fecha = iso(v.fecha)
  const desde = origen.deposito?.nombre ?? origen.ubicacion
  await aplicar(tx, campoId, origen.id, "salida", v.cantidad)
  await aplicar(tx, campoId, destino.id, "entrada", v.cantidad)
  const salida = await tx.movimientoForraje.create({
    data: { reservaId: origen.id, clave: v.clave, tipo: "salida", concepto: "transferencia", transferenciaId, cantidad: v.cantidad, fecha, motivo: v.motivo || `Transferencia a ${galpon.nombre}` },
  })
  const entrada = await tx.movimientoForraje.create({
    data: { reservaId: destino.id, clave: randomUUID(), tipo: "entrada", concepto: "transferencia", transferenciaId, cantidad: v.cantidad, fecha, motivo: v.motivo || `Transferencia desde ${desde}` },
  })
  await audit(tx, ctx, campoId, salida.id, "movimientos_forraje")
  await audit(tx, ctx, campoId, entrada.id, "movimientos_forraje")
  return { ...salida, reservaDestinoId: destino.id }
}

// ------------------------------------------------------------
// Resúmenes (fichas del mapa y tarjetas de campaña)
// ------------------------------------------------------------

export interface TotalUnidad { unidad: string; cantidad: string }

/** Suma cantidades por unidad sin mezclar fardos, rollos y kg. */
export function totalesPorUnidad(rows: { cantidad: Prisma.Decimal | string; unidad: string }[]): TotalUnidad[] {
  const map = new Map<string, Prisma.Decimal>()
  for (const r of rows) map.set(r.unidad, (map.get(r.unidad) ?? new Prisma.Decimal(0)).plus(r.cantidad))
  return [...map].map(([unidad, cantidad]) => ({ unidad, cantidad: cantidad.toString() })).sort((a, b) => a.unidad.localeCompare(b.unidad))
}
