// Escrituras del inventario de insumos (productos, lotes y movimientos de stock).
// - Solo admin o encargado de la organización dueña del producto pueden escribir.
// - Los productos del catálogo general (organizacionId = NULL) son de referencia:
//   no llevan lotes ni movimientos propios.
// - El stock nunca queda negativo: el saldo se controla dentro de la transacción.
// - Un ajuste tiene sentido: se guarda con signo (cantidad negativa = faltante).
// - La clave (UUID del cliente) hace idempotentes los reintentos.

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { anulacionSchema, loteSchema, loteUpdateSchema, movimientoStockSchema, productoConfigSchema, productoSchema } from "./validation"
import { randomUUID } from "node:crypto"
import { estadoVencimiento, hoyArgentina } from "./fechas"
import { CERO, repartirFefo, saldosPorLote, saldosPorProducto, type Asignacion } from "./stock"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"

export class InventarioError extends Error { constructor(message: string, public status = 400) { super(message) } }

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
        if (prior.productoId !== v.productoId || prior.tipo !== v.tipo || !total.equals(cantidad.times(signo)) || !loteIgual) {
          throw new InventarioError("La clave de operación ya fue utilizada con otros datos", 409)
        }
        return { movimiento: prior, filas, producto, repetido: true }
      }
    }
    const lote = v.loteProductoId ? await tx.loteProducto.findFirst({ where: { id: v.loteProductoId, productoId: v.productoId } }) : null
    if (v.loteProductoId && !lote) throw new InventarioError("El lote no existe o no pertenece al producto", 400)

    let asignaciones: Asignacion[] = [{ loteProductoId: v.loteProductoId, cantidad }]
    if (resta) {
      const saldo = await saldoProducto(tx, v.productoId)
      if (saldo.lt(cantidad)) throw new InventarioError(`Stock insuficiente: hay ${fmt(Prisma.Decimal.max(saldo, 0))} ${producto.unidad} disponibles`, 409)
      const { porLote, sinLote } = await saldosPorLote(tx, [v.productoId])
      if (lote) {
        const saldoLote = porLote.get(lote.id) ?? CERO
        if (saldoLote.lt(cantidad)) throw new InventarioError(`El lote ${lote.nroLote} tiene ${fmt(Prisma.Decimal.max(saldoLote, 0))} ${producto.unidad}`, 409)
      } else {
        // Sin lote elegido: se descuenta primero del lote vigente que vence antes
        const lotes = await tx.loteProducto.findMany({ where: { productoId: v.productoId, id: { in: [...porLote.keys()] } } })
        const hoy = hoyArgentina()
        const reparto = repartirFefo(cantidad, lotes.map((l) => ({ id: l.id, vencimiento: l.vencimiento, createdAt: l.createdAt, vencido: estadoVencimiento(l.vencimiento, { hoy }).vencido, saldo: porLote.get(l.id) ?? CERO })), sinLote.get(v.productoId) ?? CERO)
        if (!reparto) throw new InventarioError(`Stock insuficiente: hay ${fmt(Prisma.Decimal.max(saldo, 0))} ${producto.unidad} disponibles`, 409)
        asignaciones = reparto
      }
    }

    // Fecha del día elegido (mediodía de Argentina, para que no cambie de día por zona horaria) o ahora
    const fecha = v.fecha && v.fecha !== hoyArgentina() ? new Date(`${v.fecha}T12:00:00-03:00`) : new Date()
    const operacionId = asignaciones.length > 1 ? randomUUID() : null
    const filas = []
    for (const [i, a] of asignaciones.entries()) {
      filas.push(await tx.movimientoStock.create({
        data: { productoId: v.productoId, loteProductoId: a.loteProductoId, tipo: v.tipo, cantidad: a.cantidad.times(signo), motivo: v.motivo, fecha, clave: i === 0 ? v.clave : null, operacionId },
      }))
    }
    await tx.auditLog.create({
      data: {
        usuarioId: ctx.userId, organizacionId: producto.organizacionId, tabla: "movimientos_stock", rowPk: filas[0].id, accion: "INSERT",
        detalle: { productoId: v.productoId, productoNombre: producto.nombre, tipo: v.tipo, cantidad: cantidad.times(signo).toNumber(), motivo: v.motivo, lotes: asignaciones.map((a) => ({ loteProductoId: a.loteProductoId, cantidad: a.cantidad.toNumber() })) },
      },
    })
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
    const resta = filas.reduce((n, f) => { const i = inverso(f); return i.tipo === "salida" ? n.plus(i.cantidad) : i.tipo === "ajuste" && i.cantidad.lt(0) ? n.plus(i.cantidad.neg()) : n }, new Prisma.Decimal(0))
    if (resta.gt(0)) {
      const saldo = await saldoProducto(tx, mov.productoId)
      if (saldo.lt(resta)) throw new InventarioError(`No se puede anular: dejaría el stock negativo (hay ${fmt(Prisma.Decimal.max(saldo, 0))} ${producto.unidad}). Registrá primero las salidas que correspondan.`, 409)
      const { porLote } = await saldosPorLote(tx, [mov.productoId])
      for (const f of filas.filter((x) => x.loteProductoId && inverso(x).tipo !== "entrada")) {
        if ((porLote.get(f.loteProductoId!) ?? CERO).lt(f.cantidad.abs())) throw new InventarioError("No se puede anular: el lote ya no tiene ese saldo", 409)
      }
    }
    const operacionId = filas.length > 1 ? randomUUID() : null
    const creadas = []
    for (const f of filas) {
      const i = inverso(f)
      creadas.push(await tx.movimientoStock.create({
        data: { productoId: f.productoId, loteProductoId: f.loteProductoId, sectorId: f.sectorId, tipo: i.tipo, cantidad: i.cantidad, motivo: `Anulación: ${motivo}`, anulaAId: f.id, operacionId },
      }))
    }
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: producto.organizacionId, tabla: "movimientos_stock", rowPk: mov.id, accion: "UPDATE", detalle: { anulado: filas.map((f) => f.id), contramovimientos: creadas.map((c) => c.id), motivo } } })
    return { anulados: filas.length, contramovimientos: creadas.map((c) => c.id) }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
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
