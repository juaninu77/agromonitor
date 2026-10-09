// Descuento de stock al aplicar productos a animales (Sanidad y Manga) y avisos de
// stock bajo. Lo aplicado sale del inventario en la misma transacción que el evento,
// vinculado por origenTipo/origenId. Las cantidades se calculan en la unidad del producto.

import { Prisma } from "@prisma/client"
import { estadoVencimiento, hoyArgentina } from "./fechas"
import { asignarSalida, InventarioError } from "./service"
import { avisarStockBajo } from "./alertas"
export { consumoSugerido } from "./consumo"
import { CERO, saldosPorProducto } from "./stock"

type Tx = Prisma.TransactionClient
/**
 * Ubicación de donde sale una aplicación: la elegida, o la que más stock tiene
 * (prefiriendo los galpones del campo donde se aplica).
 */
async function ubicacion(tx: Tx, productoId: string, organizacionId: string, opts: { sectorId?: string | null; establecimientoIds: string[]; establecimientoId?: string | null }) {
  const galpones = await tx.sector.findMany({ where: { tipo: "galpon", activo: true, establecimientoId: { in: opts.establecimientoIds }, establecimiento: { organizacionId } }, select: { id: true, nombre: true, establecimientoId: true } })
  if (opts.sectorId !== undefined) {
    if (opts.sectorId === null) return null
    const g = galpones.find((x) => x.id === opts.sectorId)
    if (!g) throw new InventarioError("Galpón no encontrado", 404)
    return g
  }
  const grupos = await tx.movimientoStock.groupBy({ by: ["sectorId", "tipo"], where: { productoId }, _sum: { cantidad: true } })
  const saldo = new Map<string | null, Prisma.Decimal>()
  for (const g of grupos) saldo.set(g.sectorId, (saldo.get(g.sectorId) ?? CERO).plus(g.tipo === "salida" ? (g._sum.cantidad ?? CERO).neg() : (g._sum.cantidad ?? CERO)))
  const candidatos: ({ id: string; nombre: string; establecimientoId: string } | null)[] = [null, ...galpones]
  const puntaje = (c: (typeof candidatos)[number]) => (saldo.get(c?.id ?? null) ?? CERO).toNumber() + (c && c.establecimientoId === opts.establecimientoId ? 0.0001 : 0)
  return candidatos.sort((a, b) => puntaje(b) - puntaje(a))[0]
}

export interface Descuento {
  productoId: string
  cantidad: number
  loteProductoId?: string | null
  sectorId?: string | null
  fecha: Date
  motivo: string
  origenTipo: "sanidad" | "manga"
  origenId: string
}

/**
 * Descuenta una aplicación del stock (FEFO dentro de la ubicación, o del lote elegido).
 * - `estricto`: si no alcanza o el lote está vencido, error 409 (Sanidad: el usuario decide).
 * - no estricto: descuenta lo que haya y devuelve el faltante (Manga: la sesión no se traba).
 */
export async function descontarAplicacion(tx: Tx, d: Descuento, ctx: { establecimientoIds: string[]; establecimientoId?: string | null; estricto: boolean; aceptarVencido?: boolean }) {
  const producto = await tx.producto.findUnique({ where: { id: d.productoId }, select: { id: true, nombre: true, unidad: true, organizacionId: true } })
  if (!producto?.organizacionId) throw new InventarioError("Producto no encontrado", 404)
  const lote = d.loteProductoId ? await tx.loteProducto.findFirst({ where: { id: d.loteProductoId, productoId: d.productoId } }) : null
  if (d.loteProductoId && !lote) throw new InventarioError("El lote no existe o no pertenece al producto", 400)
  if (lote && ctx.estricto && !ctx.aceptarVencido && estadoVencimiento(lote.vencimiento, { hoy: hoyArgentina() }).vencido) {
    throw new InventarioError(`El lote ${lote.nroLote} está vencido. Confirmá si igual lo aplicaste.`, 409, "lote_vencido")
  }
  const galpon = await ubicacion(tx, d.productoId, producto.organizacionId, { sectorId: d.sectorId, establecimientoIds: ctx.establecimientoIds, establecimientoId: ctx.establecimientoId })
  let cantidad = new Prisma.Decimal(d.cantidad)
  let faltante = CERO
  if (!ctx.estricto) {
    const disponible = (await saldosPorProducto(tx, [d.productoId], { sectorId: galpon?.id ?? null })).get(d.productoId) ?? CERO
    if (disponible.lt(cantidad)) { faltante = cantidad.minus(Prisma.Decimal.max(disponible, 0)); cantidad = Prisma.Decimal.max(disponible, 0) }
    if (cantidad.lte(0)) return { descontado: 0, faltante: faltante.toNumber(), unidad: producto.unidad, ubicacion: galpon?.nombre ?? null }
  }
  const asignaciones = await asignarSalida(tx, producto, cantidad, { galpon, lote: lote ? { id: lote.id, nroLote: lote.nroLote } : null })
  const operacionId = asignaciones.length > 1 ? crypto.randomUUID() : null
  for (const a of asignaciones) {
    await tx.movimientoStock.create({ data: { productoId: d.productoId, loteProductoId: a.loteProductoId, sectorId: galpon?.id ?? null, tipo: "salida", cantidad: a.cantidad, motivo: d.motivo, fecha: d.fecha, operacionId, origenTipo: d.origenTipo, origenId: d.origenId } })
  }
  await avisarStockBajo(tx, [d.productoId])
  return { descontado: cantidad.toNumber(), faltante: faltante.toNumber(), unidad: producto.unidad, ubicacion: galpon?.nombre ?? null }
}
