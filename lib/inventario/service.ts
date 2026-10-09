// Escrituras del inventario de insumos (productos, lotes y movimientos de stock).
// - Solo admin o encargado de la organización dueña del producto pueden escribir.
// - Los productos del catálogo general (organizacionId = NULL) son de referencia:
//   no llevan lotes ni movimientos propios.
// - El stock nunca queda negativo: el saldo se controla dentro de la transacción.
// - Un ajuste tiene sentido: se guarda con signo (cantidad negativa = faltante).
// - La clave (UUID del cliente) hace idempotentes los reintentos.

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { anulacionSchema, loteSchema, loteUpdateSchema, movimientoStockSchema, productoConfigSchema, productoSchema, recuentoSchema, transferenciaStockSchema } from "./validation"
import { randomUUID } from "node:crypto"
import { estadoVencimiento, hoyArgentina } from "./fechas"
import { CERO, repartirFefo, saldosPorLote, saldosPorProducto, type Asignacion } from "./stock"
import { avisarStockBajo } from "./alertas"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"

export class InventarioError extends Error { constructor(message: string, public status = 400, public codigo?: string) { super(message) } }

const ROLES_ESCRITURA = ["admin", "encargado"] as const
/** Organizaciones en las que el usuario puede escribir inventario. */
export const orgsEscritura = (ctx: AuthContext) => ctx.organizacionIdsConRol([...ROLES_ESCRITURA])

/** Producto propio de una organización donde el usuario es admin/encargado. */
export async function productoEditable(tx: Prisma.TransactionClient, ctx: AuthContext, productoId: string) {
  const producto = await tx.producto.findFirst({ where: { id: productoId, OR: [{ organizacionId: { in: ctx.organizacionIds } }, { organizacionId: null }] } })
  if (!producto) throw new InventarioError("Producto no encontrado", 404)
  if (!producto.organizacionId) throw new InventarioError("Es un producto del catálogo general: cargalo en tu organización para registrar lotes y stock", 400)
  if (!orgsEscritura(ctx).includes(producto.organizacionId)) throw new InventarioError("Solo un administrador o encargado de la organización puede modificar el inventario", 403)
  return producto
}

/** Saldo del producto (todas las ubicaciones). Los ajustes se guardan con signo. */
export async function saldoProducto(tx: Prisma.TransactionClient, productoId: string) {
  return (await saldosPorProducto(tx, [productoId])).get(productoId) ?? CERO
}

const fmt = (d: Prisma.Decimal) => d.toDecimalPlaces(3).toNumber().toLocaleString("es-AR")

/** Nombre legible de una ubicación (galpón o sin galpón) para los mensajes. */
const enUbicacion = (galpon: { nombre: string } | null) => (galpon ? ` en ${galpon.nombre}` : " sin galpón asignado")

/**
 * Galpón donde se registra el movimiento: del mapa, activo, de un campo donde el usuario
 * es admin/encargado y de la misma organización que el producto. null = sin galpón.
 */
export async function galponEditable(tx: Prisma.TransactionClient, ctx: AuthContext, sectorId: string | null, organizacionId: string) {
  if (!sectorId) return null
  const g = await tx.sector.findFirst({ where: { id: sectorId, tipo: "galpon", activo: true, establecimientoId: { in: ctx.establecimientoIdsConRol([...ROLES_ESCRITURA]) } }, select: { id: true, nombre: true, establecimientoId: true } })
  if (!g || ctx.organizacionDeEstablecimiento[g.establecimientoId] !== organizacionId) throw new InventarioError("Galpón no encontrado o sin permisos para cargar stock ahí", 404)
  return g
}

/**
 * Cómo se descuenta `cantidad` de una ubicación (galpón o sin galpón): del lote elegido
 * o repartido FEFO entre los lotes que hay ahí. Error 409 si no alcanza.
 */
export async function asignarSalida(tx: Prisma.TransactionClient, producto: { id: string; unidad: string }, cantidad: Prisma.Decimal, ubic: { galpon: { id: string; nombre: string } | null; lote: { id: string; nroLote: string } | null }): Promise<Asignacion[]> {
  const where = { sectorId: ubic.galpon?.id ?? null }
  const saldo = (await saldosPorProducto(tx, [producto.id], where)).get(producto.id) ?? CERO
  if (saldo.lt(cantidad)) throw new InventarioError(`Stock insuficiente${enUbicacion(ubic.galpon)}: hay ${fmt(Prisma.Decimal.max(saldo, 0))} ${producto.unidad}`, 409)
  const { porLote, sinLote } = await saldosPorLote(tx, [producto.id], where)
  if (ubic.lote) {
    const saldoLote = porLote.get(ubic.lote.id) ?? CERO
    if (saldoLote.lt(cantidad)) throw new InventarioError(`El lote ${ubic.lote.nroLote} tiene ${fmt(Prisma.Decimal.max(saldoLote, 0))} ${producto.unidad}${enUbicacion(ubic.galpon)}`, 409)
    return [{ loteProductoId: ubic.lote.id, cantidad }]
  }
  // Sin lote elegido: se descuenta primero del lote vigente que vence antes
  const lotes = await tx.loteProducto.findMany({ where: { productoId: producto.id, id: { in: [...porLote.keys()] } } })
  const hoy = hoyArgentina()
  const reparto = repartirFefo(cantidad, lotes.map((l) => ({ id: l.id, vencimiento: l.vencimiento, createdAt: l.createdAt, vencido: estadoVencimiento(l.vencimiento, { hoy }).vencido, saldo: porLote.get(l.id) ?? CERO })), sinLote.get(producto.id) ?? CERO)
  if (!reparto) throw new InventarioError(`Stock insuficiente${enUbicacion(ubic.galpon)}: hay ${fmt(Prisma.Decimal.max(saldo, 0))} ${producto.unidad}`, 409)
  return reparto
}

/** Fecha del día elegido (mediodía de Argentina, para que no cambie de día por zona horaria) o ahora. */
export const fechaMovimiento = (dia: string | null) => (dia && dia !== hoyArgentina() ? new Date(`${dia}T12:00:00-03:00`) : new Date())

export async function registrarMovimientoStock(ctx: AuthContext, raw: unknown) {
  const v = movimientoStockSchema.parse(raw)
  const cantidad = new Prisma.Decimal(v.cantidad)
  const resta = v.tipo === "salida" || (v.tipo === "ajuste" && v.sentido === "restar")
  // Un ajuste que resta se guarda negativo para que todos los saldos lo descuenten
  const signo = v.tipo === "ajuste" && v.sentido === "restar" ? -1 : 1
  return prisma.$transaction(async (tx) => {
    const producto = await productoEditable(tx, ctx, v.productoId)
    if (!producto.activo) throw new InventarioError("El producto está archivado: reactivalo para registrar movimientos")
    if (v.clave) {
      const prior = await tx.movimientoStock.findUnique({ where: { clave: v.clave } })
      if (prior) {
        // Una salida repartida entre lotes son varias filas con el mismo operacionId
        const filas = prior.operacionId ? await tx.movimientoStock.findMany({ where: { operacionId: prior.operacionId } }) : [prior]
        const total = filas.reduce((n, f) => n.plus(f.cantidad), new Prisma.Decimal(0))
        const loteIgual = !v.loteProductoId || (filas.length === 1 && prior.loteProductoId === v.loteProductoId)
        if (prior.productoId !== v.productoId || prior.tipo !== v.tipo || !total.equals(cantidad.times(signo)) || !loteIgual || (prior.sectorId ?? null) !== v.sectorId) {
          throw new InventarioError("La clave de operación ya fue utilizada con otros datos", 409)
        }
        return { movimiento: prior, filas, producto, repetido: true }
      }
    }
    const lote = v.loteProductoId ? await tx.loteProducto.findFirst({ where: { id: v.loteProductoId, productoId: v.productoId } }) : null
    if (v.loteProductoId && !lote) throw new InventarioError("El lote no existe o no pertenece al producto", 400)

    const galpon = await galponEditable(tx, ctx, v.sectorId, producto.organizacionId!)
    // Salidas y ajustes que restan se controlan contra el saldo de esa ubicación (galpón o sin galpón)
    const asignaciones: Asignacion[] = resta
      ? await asignarSalida(tx, producto, cantidad, { galpon, lote })
      : [{ loteProductoId: v.loteProductoId, cantidad }]

    const fecha = fechaMovimiento(v.fecha)
    const operacionId = asignaciones.length > 1 ? randomUUID() : null
    const filas = []
    for (const [i, a] of asignaciones.entries()) {
      filas.push(await tx.movimientoStock.create({
        data: { productoId: v.productoId, loteProductoId: a.loteProductoId, sectorId: galpon?.id ?? null, tipo: v.tipo, cantidad: a.cantidad.times(signo), motivo: v.motivo, fecha, clave: i === 0 ? v.clave : null, operacionId },
      }))
    }
    await tx.auditLog.create({
      data: {
        usuarioId: ctx.userId, organizacionId: producto.organizacionId, tabla: "movimientos_stock", rowPk: filas[0].id, accion: "INSERT",
        detalle: { productoId: v.productoId, productoNombre: producto.nombre, tipo: v.tipo, cantidad: cantidad.times(signo).toNumber(), motivo: v.motivo, lotes: asignaciones.map((a) => ({ loteProductoId: a.loteProductoId, cantidad: a.cantidad.toNumber() })) },
      },
    })
    if (resta) await avisarStockBajo(tx, [v.productoId])
    return { movimiento: filas[0], filas, producto, repetido: false }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
}

export async function crearProducto(ctx: AuthContext, raw: unknown) {
  const v = productoSchema.parse(raw)
  const permitidas = orgsEscritura(ctx)
  let organizacionId: string
  if (v.organizacionId) {
    if (!permitidas.includes(v.organizacionId)) throw new InventarioError("Solo un administrador o encargado de esa organización puede cargar productos", 403)
    organizacionId = v.organizacionId
  } else if (permitidas.length === 1) {
    organizacionId = permitidas[0]
  } else if (!permitidas.length) {
    throw new InventarioError("Solo un administrador o encargado puede cargar productos", 403)
  } else {
    throw new InventarioError("Indicá la organización del producto", 400)
  }
  const { organizacionId: _omit, ...data } = v
  return prisma.$transaction(async (tx) => {
    await nombreLibre(tx, organizacionId, v.nombre)
    const producto = await tx.producto.create({ data: { ...data, organizacionId } })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId, tabla: "productos", rowPk: producto.id, accion: "INSERT", detalle: { nombre: producto.nombre, tipo: producto.tipo } } })
    return producto
  })
}

/** El nombre de un producto es único dentro de la organización (sin distinguir mayúsculas). */
async function nombreLibre(tx: Prisma.TransactionClient, organizacionId: string, nombre: string, excepto?: string) {
  const otro = await tx.producto.findFirst({ where: { organizacionId, nombre: { equals: nombre, mode: "insensitive" }, ...(excepto ? { id: { not: excepto } } : {}) }, select: { id: true } })
  if (otro) throw new InventarioError(`Ya existe un producto llamado «${nombre}»`, 409)
}

/** Editar datos y configuración del producto. Archivar exige stock en cero. */
export async function configurarProducto(ctx: AuthContext, productoId: string, raw: unknown) {
  const v = productoConfigSchema.parse(raw)
  return prisma.$transaction(async (tx) => {
    const producto = await productoEditable(tx, ctx, productoId)
    if (v.nombre && v.nombre !== producto.nombre) await nombreLibre(tx, producto.organizacionId!, v.nombre, productoId)
    if (v.activo === false && producto.activo) {
      const saldo = await saldoProducto(tx, productoId)
      if (!saldo.isZero()) throw new InventarioError(`Tiene ${fmt(saldo)} ${producto.unidad} en stock: registrá la salida o un ajuste antes de archivarlo`, 409)
    }
    const actualizado = await tx.producto.update({ where: { id: productoId }, data: v })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: producto.organizacionId, tabla: "productos", rowPk: productoId, accion: "UPDATE", detalle: JSON.parse(JSON.stringify(v)) } })
    return actualizado
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export const actualizarProducto = configurarProducto

/** Editar datos de un lote (número, vencimiento, proveedor, costo). La cantidad solo cambia con movimientos. */
export async function actualizarLote(ctx: AuthContext, productoId: string, loteId: string, raw: unknown) {
  const v = loteUpdateSchema.parse(raw)
  return prisma.$transaction(async (tx) => {
    const producto = await productoEditable(tx, ctx, productoId)
    const lote = await tx.loteProducto.findFirst({ where: { id: loteId, productoId } })
    if (!lote) throw new InventarioError("Lote no encontrado", 404)
    if (v.nroLote && v.nroLote.toLowerCase() !== lote.nroLote.toLowerCase() && await tx.loteProducto.findFirst({ where: { productoId, nroLote: { equals: v.nroLote, mode: "insensitive" }, id: { not: loteId } }, select: { id: true } })) {
      throw new InventarioError(`Ya existe el lote ${v.nroLote} de este producto`, 409)
    }
    const data: Prisma.LoteProductoUpdateInput = {
      ...(v.nroLote ? { nroLote: v.nroLote } : {}),
      ...(v.vencimiento !== undefined ? { vencimiento: v.vencimiento ? new Date(`${v.vencimiento}T00:00:00Z`) : null } : {}),
      ...(v.proveedor !== undefined ? { proveedor: v.proveedor } : {}),
      ...(v.costo !== undefined ? { costo: v.costo } : {}),
    }
    const actualizado = await tx.loteProducto.update({ where: { id: loteId }, data })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: producto.organizacionId, tabla: "lotes_producto", rowPk: loteId, accion: "UPDATE", detalle: JSON.parse(JSON.stringify(v)) } })
    return actualizado
  })
}

/**
 * Anular un movimiento con su contramovimiento (no se borra historial). Si el movimiento
 * es parte de una operación repartida entre lotes, se anula la operación completa.
 * Anular una entrada exige que el stock alcance (no puede quedar negativo).
 */
export async function anularMovimiento(ctx: AuthContext, movimientoId: string, raw: unknown) {
  const { motivo } = anulacionSchema.parse(raw)
  return prisma.$transaction(async (tx) => {
    const mov = await tx.movimientoStock.findUnique({ where: { id: movimientoId }, include: { anuladoPor: { select: { id: true } } } })
    if (!mov) throw new InventarioError("Movimiento no encontrado", 404)
    const producto = await productoEditable(tx, ctx, mov.productoId)
    if (mov.anulaAId) throw new InventarioError("Es una anulación: no se puede anular")
    const filas = mov.operacionId ? await tx.movimientoStock.findMany({ where: { operacionId: mov.operacionId }, include: { anuladoPor: { select: { id: true } } } }) : [mov]
    if (filas.some((f) => f.anuladoPor)) throw new InventarioError("El movimiento ya fue anulado", 409)

    // Contramovimiento: entrada ↔ salida; un ajuste se anula con el ajuste de signo contrario
    const inverso = (f: (typeof filas)[number]) => (f.tipo === "entrada" ? { tipo: "salida", cantidad: f.cantidad } : f.tipo === "salida" ? { tipo: "entrada", cantidad: f.cantidad } : { tipo: "ajuste", cantidad: f.cantidad.neg() })
    // Lo que el contramovimiento descuenta, por ubicación (galpón o sin galpón) y lote: no puede dejar nada negativo
    const descuentos = new Map<string, { sectorId: string | null; loteId: string | null; cantidad: Prisma.Decimal }>()
    for (const f of filas) {
      const i = inverso(f)
      const resta = i.tipo === "salida" ? i.cantidad : i.tipo === "ajuste" && i.cantidad.lt(0) ? i.cantidad.neg() : null
      if (!resta) continue
      const k = `${f.sectorId ?? "-"}|${f.loteProductoId ?? "-"}`
      const d = descuentos.get(k) ?? { sectorId: f.sectorId, loteId: f.loteProductoId, cantidad: new Prisma.Decimal(0) }
      descuentos.set(k, { ...d, cantidad: d.cantidad.plus(resta) })
    }
    for (const d of descuentos.values()) {
      const { porLote, sinLote } = await saldosPorLote(tx, [mov.productoId], { sectorId: d.sectorId })
      const disponible = d.loteId ? porLote.get(d.loteId) ?? CERO : sinLote.get(mov.productoId) ?? CERO
      if (disponible.lt(d.cantidad)) throw new InventarioError(`No se puede anular: dejaría el stock negativo (quedan ${fmt(Prisma.Decimal.max(disponible, 0))} ${producto.unidad} de lo que entró con ese movimiento). Registrá primero las salidas que correspondan.`, 409)
    }
    const operacionId = filas.length > 1 ? randomUUID() : null
    const creadas = []
    for (const f of filas) {
      const i = inverso(f)
      creadas.push(await tx.movimientoStock.create({
        data: { productoId: f.productoId, loteProductoId: f.loteProductoId, sectorId: f.sectorId, tipo: i.tipo, cantidad: i.cantidad, motivo: `Anulación: ${motivo}`, anulaAId: f.id, operacionId, concepto: f.concepto },
      }))
    }
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: producto.organizacionId, tabla: "movimientos_stock", rowPk: mov.id, accion: "UPDATE", detalle: { anulado: filas.map((f) => f.id), contramovimientos: creadas.map((c) => c.id), motivo } } })
    if (descuentos.size) await avisarStockBajo(tx, [mov.productoId])
    return { anulados: filas.length, contramovimientos: creadas.map((c) => c.id) }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
}

/**
 * Transferir stock entre ubicaciones (galpón ↔ galpón, o reubicar stock sin galpón):
 * salida en origen + entrada en destino por cada lote, atómicas, con el mismo operacionId.
 * El total del producto no cambia.
 */
export async function transferirStock(ctx: AuthContext, raw: unknown) {
  const v = transferenciaStockSchema.parse(raw)
  const cantidad = new Prisma.Decimal(v.cantidad)
  return prisma.$transaction(async (tx) => {
    const producto = await productoEditable(tx, ctx, v.productoId)
    if (!producto.activo) throw new InventarioError("El producto está archivado: reactivalo para moverlo")
    if (v.clave) {
      const prior = await tx.movimientoStock.findUnique({ where: { clave: v.clave } })
      if (prior) {
        if (prior.productoId !== v.productoId || prior.concepto !== "transferencia") throw new InventarioError("La clave de operación ya fue utilizada con otros datos", 409)
        return { operacionId: prior.operacionId, repetido: true, filas: 0 }
      }
    }
    const [desde, hacia] = [await galponEditable(tx, ctx, v.desdeSectorId, producto.organizacionId!), await galponEditable(tx, ctx, v.haciaSectorId, producto.organizacionId!)]
    const lote = v.loteProductoId ? await tx.loteProducto.findFirst({ where: { id: v.loteProductoId, productoId: v.productoId } }) : null
    if (v.loteProductoId && !lote) throw new InventarioError("El lote no existe o no pertenece al producto", 400)
    const asignaciones = await asignarSalida(tx, producto, cantidad, { galpon: desde, lote })
    const operacionId = randomUUID(), fecha = fechaMovimiento(v.fecha)
    const motivo = v.motivo ?? `Transferencia${desde ? ` desde ${desde.nombre}` : " (sin galpón)"} a ${hacia ? hacia.nombre : "sin galpón"}`
    let primera = true
    for (const a of asignaciones) {
      await tx.movimientoStock.create({ data: { productoId: v.productoId, loteProductoId: a.loteProductoId, sectorId: desde?.id ?? null, tipo: "salida", concepto: "transferencia", cantidad: a.cantidad, motivo, fecha, operacionId, clave: primera ? v.clave : null } })
      await tx.movimientoStock.create({ data: { productoId: v.productoId, loteProductoId: a.loteProductoId, sectorId: hacia?.id ?? null, tipo: "entrada", concepto: "transferencia", cantidad: a.cantidad, motivo, fecha, operacionId } })
      primera = false
    }
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: producto.organizacionId, tabla: "movimientos_stock", rowPk: operacionId, accion: "INSERT", detalle: { transferencia: true, productoId: v.productoId, desde: desde?.id ?? null, hacia: hacia?.id ?? null, cantidad: cantidad.toNumber() } } })
    return { operacionId, repetido: false, filas: asignaciones.length * 2 }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
}

/**
 * Recuento físico de una ubicación: por cada producto contado se compara con el sistema y
 * se registra un ajuste por la diferencia (concepto «recuento»). Un faltante se descuenta
 * FEFO de los lotes de esa ubicación; un sobrante entra sin lote. Todo en una operación.
 */
export interface ResumenRecuento {
  operacionId: string
  ubicacion: string
  ajustados: number
  items: { productoId: string; nombre: string; unidad: string; sistema: number; contado: number; diferencia: number }[]
}

export async function registrarRecuento(ctx: AuthContext, raw: unknown): Promise<ResumenRecuento & { repetido: boolean }> {
  const v = recuentoSchema.parse(raw)
  return prisma.$transaction(async (tx) => {
    if (v.clave) {
      const prior = await tx.auditLog.findFirst({ where: { tabla: "recuentos_stock", rowPk: v.clave, usuarioId: ctx.userId }, select: { detalle: true } })
      if (prior) return { ...(prior.detalle as unknown as ResumenRecuento), repetido: true }
    }
    const operacionId = randomUUID(), fecha = fechaMovimiento(v.fecha)
    const resultado: { productoId: string; nombre: string; unidad: string; sistema: number; contado: number; diferencia: number }[] = []
    let organizacionId: string | null = null
    let galpon: Awaited<ReturnType<typeof galponEditable>> = null
    for (const item of v.items) {
      const producto = await productoEditable(tx, ctx, item.productoId)
      if (organizacionId && producto.organizacionId !== organizacionId) throw new InventarioError("Un recuento es de una sola organización")
      if (!organizacionId) { organizacionId = producto.organizacionId!; galpon = await galponEditable(tx, ctx, v.sectorId, organizacionId) }
      const sistema = (await saldosPorProducto(tx, [producto.id], { sectorId: galpon?.id ?? null })).get(producto.id) ?? CERO
      const contado = new Prisma.Decimal(item.contado)
      const diferencia = contado.minus(sistema)
      resultado.push({ productoId: producto.id, nombre: producto.nombre, unidad: producto.unidad, sistema: sistema.toNumber(), contado: contado.toNumber(), diferencia: diferencia.toNumber() })
      if (diferencia.isZero()) continue
      const motivo = `Recuento${galpon ? ` ${galpon.nombre}` : " sin galpón"}: sistema ${fmt(sistema)}, contado ${fmt(contado)}${v.motivo ? ` · ${v.motivo}` : ""}`
      const asignaciones: Asignacion[] = diferencia.gt(0)
        ? [{ loteProductoId: null, cantidad: diferencia }]
        : (await asignarSalida(tx, producto, diferencia.neg(), { galpon, lote: null })).map((a) => ({ ...a, cantidad: a.cantidad.neg() }))
      for (const a of asignaciones) {
        await tx.movimientoStock.create({ data: { productoId: producto.id, loteProductoId: a.loteProductoId, sectorId: galpon?.id ?? null, tipo: "ajuste", concepto: "recuento", cantidad: a.cantidad, motivo, fecha, operacionId } })
      }
    }
    await avisarStockBajo(tx, resultado.filter((r) => r.diferencia < 0).map((r) => r.productoId))
    const resumen: ResumenRecuento = { operacionId, ubicacion: galpon?.nombre ?? "Sin galpón asignado", items: resultado, ajustados: resultado.filter((r) => r.diferencia !== 0).length }
    // El registro de auditoría también sirve para que reenviar el mismo recuento no lo duplique
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId, tabla: "recuentos_stock", rowPk: v.clave ?? operacionId, accion: "INSERT", detalle: JSON.parse(JSON.stringify(resumen)) } })
    return { ...resumen, repetido: false }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 })
}

export async function crearLote(ctx: AuthContext, productoId: string, raw: unknown) {
  const v = loteSchema.parse(raw)
  return prisma.$transaction(async (tx) => {
    const producto = await productoEditable(tx, ctx, productoId)
    if (!producto.activo) throw new InventarioError("El producto está archivado: reactivalo para cargar lotes")
    if (v.clave) {
      const prior = await tx.movimientoStock.findUnique({ where: { clave: v.clave }, include: { loteProducto: true } })
      if (prior?.loteProducto) {
        if (prior.productoId !== productoId || prior.loteProducto.nroLote !== v.nroLote) throw new InventarioError("La clave de operación ya fue utilizada con otros datos", 409)
        return prior.loteProducto
      }
    }
    if (await tx.loteProducto.findFirst({ where: { productoId, nroLote: { equals: v.nroLote, mode: "insensitive" } }, select: { id: true } })) {
      throw new InventarioError(`Ya existe el lote ${v.nroLote} de este producto`, 409)
    }
    if (v.proveedorId && !await tx.proveedor.findFirst({ where: { id: v.proveedorId, organizacionId: producto.organizacionId! }, select: { id: true } })) {
      throw new InventarioError("Proveedor no encontrado en la organización", 404)
    }
    const lote = await tx.loteProducto.create({
      data: { productoId, nroLote: v.nroLote, vencimiento: v.vencimiento ? new Date(`${v.vencimiento}T00:00:00Z`) : null, proveedor: v.proveedor, proveedorId: v.proveedorId, cantidad: v.cantidad, unidad: v.unidad, costo: v.costo },
    })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: producto.organizacionId, tabla: "lotes_producto", rowPk: lote.id, accion: "INSERT", detalle: { productoId, nroLote: lote.nroLote } } })
    // El alta de un lote con cantidad es la entrada al stock (un solo libro de movimientos)
    if (v.cantidad && v.cantidad > 0) {
      const mov = await tx.movimientoStock.create({ data: { productoId, loteProductoId: lote.id, tipo: "entrada", cantidad: v.cantidad, motivo: `Ingreso del lote ${lote.nroLote}`, clave: v.clave } })
      await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: producto.organizacionId, tabla: "movimientos_stock", rowPk: mov.id, accion: "INSERT", detalle: { productoId, loteProductoId: lote.id, tipo: "entrada", cantidad: v.cantidad } } })
    }
    return lote
  })
}

/** Respuesta uniforme de error para las rutas de inventario. */
export function respuestaError(error: unknown) {
  if (error instanceof InventarioError) return { body: { success: false, error: error.message }, status: error.status }
  if (error instanceof z.ZodError) return { body: { success: false, error: error.issues[0]?.message ?? "Datos inválidos", details: error.flatten().fieldErrors }, status: 400 }
  if (error instanceof SyntaxError) return { body: { success: false, error: "Datos inválidos" }, status: 400 }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034") return { body: { success: false, error: "Otro usuario registró un movimiento al mismo tiempo. Reintentá." }, status: 409 }
    if (error.code === "P2002") return { body: { success: false, error: "Esta operación ya se registró" }, status: 409 }
  }
  return null
}
