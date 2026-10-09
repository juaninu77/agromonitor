// Alertas de inventario: stock bajo (según el mínimo de cada producto) y lotes por vencer
// o vencidos que todavía tienen saldo. Se muestran en el Panel y se avisan por notificación
// a propietarios, administradores y encargados (un aviso sin leer por producto o lote).

import { Prisma } from "@prisma/client"
import { estadoVencimiento, hoyArgentina } from "./fechas"
import { aNumero, CERO, saldosPorLote, saldosPorProducto } from "./stock"

type Db = Prisma.TransactionClient
const GESTORES = ["propietario", "admin", "administrador", "encargado"]
const DIAS_AVISO_VENCIMIENTO = 30

async function notificar(db: Db, organizacionId: string, tipo: string, url: string, titulo: string, mensaje: string) {
  const destinatarios = await db.membresia.findMany({ where: { organizacionId, esActivo: true, rol: { in: GESTORES }, usuario: { esActivo: true } }, select: { usuarioId: true } })
  if (!destinatarios.length) return
  const yaAvisados = new Set((await db.notificacion.findMany({ where: { tipo, url, leida: false, usuarioId: { in: destinatarios.map((d) => d.usuarioId) } }, select: { usuarioId: true } })).map((n) => n.usuarioId))
  const nuevos = destinatarios.filter((d) => !yaAvisados.has(d.usuarioId))
  if (nuevos.length) await db.notificacion.createMany({ data: nuevos.map((d) => ({ usuarioId: d.usuarioId, tipo, titulo, mensaje, url })) })
}

/**
 * Aviso de stock bajo para propietarios, administradores y encargados de la organización,
 * cuando el producto queda en o debajo de su mínimo. Un aviso sin leer por producto.
 */
export async function avisarStockBajo(tx: Db, productoIds: string[]) {
  if (!productoIds.length) return
  const productos = await tx.producto.findMany({ where: { id: { in: productoIds }, stockMinimo: { not: null }, activo: true, organizacionId: { not: null } }, select: { id: true, nombre: true, unidad: true, stockMinimo: true, organizacionId: true } })
  if (!productos.length) return
  const saldos = await saldosPorProducto(tx, productos.map((p) => p.id))
  for (const p of productos) {
    const saldo = saldos.get(p.id) ?? CERO
    if (saldo.gt(p.stockMinimo!)) continue
    const cant = saldo.toDecimalPlaces(3).toNumber().toLocaleString("es-AR")
    await notificar(tx, p.organizacionId!, "stock_bajo", `/inventario/${p.id}`, `Stock bajo: ${p.nombre}`, `Quedan ${cant} ${p.unidad} (mínimo ${p.stockMinimo!.toNumber().toLocaleString("es-AR")}).`)
  }
}

export interface AlertasInventario {
  stockBajo: { productoId: string; nombre: string; unidad: string; stock: number; minimo: number }[]
  vencimientos: { productoId: string; nombre: string; unidad: string; loteId: string; nroLote: string; vencimiento: string; diasRestantes: number; saldo: number }[]
}

/**
 * Alertas de las organizaciones indicadas (en SQL, sin cargar movimientos). También deja
 * avisos de vencimiento sin duplicar (los de stock bajo se generan al descontar).
 */
export async function alertasInventario(db: Db, organizacionIds: string[]): Promise<AlertasInventario> {
  if (!organizacionIds.length) return { stockBajo: [], vencimientos: [] }
  const productos = await db.producto.findMany({
    where: { organizacionId: { in: organizacionIds }, activo: true },
    select: { id: true, nombre: true, unidad: true, stockMinimo: true, organizacionId: true, lotes: { where: { vencimiento: { not: null } }, select: { id: true, nroLote: true, vencimiento: true } } },
  })
  const ids = productos.map((p) => p.id)
  const [saldos, { porLote }] = await Promise.all([saldosPorProducto(db, ids), saldosPorLote(db, ids)])
  const hoy = hoyArgentina()
  const res: AlertasInventario = { stockBajo: [], vencimientos: [] }
  for (const p of productos) {
    const stock = saldos.get(p.id) ?? CERO
    if (p.stockMinimo != null && stock.lte(p.stockMinimo)) res.stockBajo.push({ productoId: p.id, nombre: p.nombre, unidad: p.unidad, stock: aNumero(stock)!, minimo: aNumero(p.stockMinimo)! })
    for (const l of p.lotes) {
      const saldo = porLote.get(l.id) ?? CERO
      if (saldo.lte(0)) continue
      const v = estadoVencimiento(l.vencimiento, { hoy, diasAlerta: DIAS_AVISO_VENCIMIENTO })
      if (!v.proximoAVencer || v.diasRestantes == null) continue
      res.vencimientos.push({ productoId: p.id, nombre: p.nombre, unidad: p.unidad, loteId: l.id, nroLote: l.nroLote, vencimiento: l.vencimiento!.toISOString(), diasRestantes: v.diasRestantes, saldo: aNumero(saldo)! })
      const cuando = v.diasRestantes < 0 ? `venció hace ${-v.diasRestantes} días` : v.diasRestantes === 0 ? "vence hoy" : `vence en ${v.diasRestantes} días`
      await notificar(db, p.organizacionId!, "vencimiento_producto", `/inventario/${p.id}?lote=${l.id}`, `${p.nombre}: lote ${l.nroLote}`, `El lote ${cuando} y quedan ${aNumero(saldo)!.toLocaleString("es-AR")} ${p.unidad}.`)
    }
  }
  res.stockBajo.sort((a, b) => a.stock / (a.minimo || 1) - b.stock / (b.minimo || 1))
  res.vencimientos.sort((a, b) => a.diasRestantes - b.diasRestantes)
  return res
}
