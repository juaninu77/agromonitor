// Saldos de stock calculados en SQL (groupBy), nunca cargando todos los movimientos.
// Saldo = entradas − salidas + ajustes (los ajustes se guardan con signo).
// Cantidades en Decimal: no se acumula error de punto flotante.

import { Prisma } from "@prisma/client"

type Db = Prisma.TransactionClient
const D = (v: Prisma.Decimal.Value | null | undefined) => new Prisma.Decimal(v ?? 0)
export const CERO = D(0)

const firmado = (tipo: string, suma: Prisma.Decimal | null) => (tipo === "salida" ? D(suma).neg() : D(suma))

/** Saldo por producto. `where` permite acotar (p. ej. a un galpón o a "sin galpón"). */
export async function saldosPorProducto(db: Db, productoIds: string[], where: Prisma.MovimientoStockWhereInput = {}) {
  const saldos = new Map<string, Prisma.Decimal>()
  if (!productoIds.length) return saldos
  const rows = await db.movimientoStock.groupBy({ by: ["productoId", "tipo"], where: { ...where, productoId: { in: productoIds } }, _sum: { cantidad: true } })
  for (const r of rows) saldos.set(r.productoId, (saldos.get(r.productoId) ?? CERO).plus(firmado(r.tipo, r._sum.cantidad)))
  return saldos
}

/** Saldo por lote de un conjunto de productos; la clave `null` es el stock sin lote de cada producto. */
export async function saldosPorLote(db: Db, productoIds: string[], where: Prisma.MovimientoStockWhereInput = {}) {
  const porLote = new Map<string, Prisma.Decimal>()
  const sinLote = new Map<string, Prisma.Decimal>()
  if (!productoIds.length) return { porLote, sinLote }
  const rows = await db.movimientoStock.groupBy({ by: ["productoId", "loteProductoId", "tipo"], where: { ...where, productoId: { in: productoIds } }, _sum: { cantidad: true } })
  for (const r of rows) {
    const v = firmado(r.tipo, r._sum.cantidad)
    if (r.loteProductoId) porLote.set(r.loteProductoId, (porLote.get(r.loteProductoId) ?? CERO).plus(v))
    else sinLote.set(r.productoId, (sinLote.get(r.productoId) ?? CERO).plus(v))
  }
  return { porLote, sinLote }
}

export interface LoteDisponible { id: string; vencimiento: Date | null; createdAt: Date; vencido: boolean; saldo: Prisma.Decimal }
export interface Asignacion { loteProductoId: string | null; cantidad: Prisma.Decimal }

/**
 * Reparte una salida entre lotes: primero los vigentes que vencen antes (FEFO),
 * después el stock sin lote y, al final, los lotes vencidos. Devuelve null si no alcanza.
 */
export function repartirFefo(cantidad: Prisma.Decimal.Value, lotes: LoteDisponible[], sinLote: Prisma.Decimal.Value): Asignacion[] | null {
  let resta = D(cantidad)
  const orden = (a: LoteDisponible, b: LoteDisponible) =>
    (a.vencimiento?.getTime() ?? Infinity) - (b.vencimiento?.getTime() ?? Infinity) || a.createdAt.getTime() - b.createdAt.getTime()
  const fuentes: { loteProductoId: string | null; saldo: Prisma.Decimal }[] = [
    ...lotes.filter((l) => !l.vencido).sort(orden).map((l) => ({ loteProductoId: l.id, saldo: l.saldo })),
    { loteProductoId: null, saldo: D(sinLote) },
    ...lotes.filter((l) => l.vencido).sort(orden).map((l) => ({ loteProductoId: l.id, saldo: l.saldo })),
  ]
  const asignaciones: Asignacion[] = []
  for (const f of fuentes) {
    if (resta.lte(0)) break
    if (f.saldo.lte(0)) continue
    const toma = Prisma.Decimal.min(resta, f.saldo)
    asignaciones.push({ loteProductoId: f.loteProductoId, cantidad: toma })
    resta = resta.minus(toma)
  }
  return resta.gt(0) ? null : asignaciones
}

/** Número para la UI (las cantidades tienen hasta 3 decimales). */
export const aNumero = (v: Prisma.Decimal.Value | null | undefined) => (v == null ? null : D(v).toDecimalPlaces(3).toNumber())
