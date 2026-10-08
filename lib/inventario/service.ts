// Escrituras del inventario de insumos (productos, lotes y movimientos de stock).
// - Solo admin o encargado de la organización dueña del producto pueden escribir.
// - Los productos del catálogo general (organizacionId = NULL) son de referencia:
//   no llevan lotes ni movimientos propios.
// - El stock nunca queda negativo: el saldo se controla dentro de la transacción.
// - Un ajuste tiene sentido: se guarda con signo (cantidad negativa = faltante).
// - La clave (UUID del cliente) hace idempotentes los reintentos.

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { loteSchema, movimientoStockSchema, productoSchema } from "./validation"
import { hoyArgentina } from "./fechas"
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
  const rows = await tx.movimientoStock.groupBy({ by: ["tipo"], where: { productoId }, _sum: { cantidad: true } })
  return rows.reduce((n, r) => n + (r.tipo === "salida" ? -1 : 1) * (r._sum.cantidad ?? 0), 0)
}

const redondear = (n: number) => Math.round(n * 1000) / 1000

export async function registrarMovimientoStock(ctx: AuthContext, raw: unknown) {
  const v = movimientoStockSchema.parse(raw)
  // Ajuste que resta: se guarda negativo para que todos los saldos lo descuenten
  const cantidadFirmada = v.tipo === "ajuste" && v.sentido === "restar" ? -v.cantidad : v.cantidad
  return prisma.$transaction(async (tx) => {
    const producto = await productoEditable(tx, ctx, v.productoId)
    if (v.clave) {
      const prior = await tx.movimientoStock.findUnique({ where: { clave: v.clave } })
      if (prior) {
        if (prior.productoId !== v.productoId || prior.tipo !== v.tipo || prior.cantidad !== cantidadFirmada || (prior.loteProductoId ?? null) !== v.loteProductoId) {
          throw new InventarioError("La clave de operación ya fue utilizada con otros datos", 409)
        }
        return { movimiento: prior, producto, repetido: true }
      }
    }
    if (v.loteProductoId) {
      const lote = await tx.loteProducto.findFirst({ where: { id: v.loteProductoId, productoId: v.productoId } })
      if (!lote) throw new InventarioError("El lote no existe o no pertenece al producto", 400)
    }
    if (cantidadFirmada < 0 || v.tipo === "salida") {
      const saldo = await saldoProducto(tx, v.productoId)
      if (redondear(saldo - Math.abs(cantidadFirmada)) < 0) {
        throw new InventarioError(`Stock insuficiente: hay ${redondear(Math.max(saldo, 0)).toLocaleString("es-AR")} disponibles`, 409)
      }
    }
    // Fecha del día elegido (mediodía de Argentina, para que no cambie de día por zona horaria) o ahora
    const fecha = v.fecha && v.fecha !== hoyArgentina() ? new Date(`${v.fecha}T12:00:00-03:00`) : new Date()
    const movimiento = await tx.movimientoStock.create({
      data: { productoId: v.productoId, loteProductoId: v.loteProductoId, tipo: v.tipo, cantidad: cantidadFirmada, motivo: v.motivo, fecha, clave: v.clave },
      include: { producto: { select: { id: true, nombre: true, tipo: true } }, loteProducto: { select: { id: true, nroLote: true, vencimiento: true } } },
    })
    await tx.auditLog.create({
      data: {
        usuarioId: ctx.userId, organizacionId: producto.organizacionId, tabla: "movimientos_stock", rowPk: movimiento.id, accion: "INSERT",
        detalle: { productoId: v.productoId, productoNombre: producto.nombre, tipo: v.tipo, cantidad: cantidadFirmada, motivo: v.motivo, loteProductoId: v.loteProductoId },
      },
    })
    return { movimiento, producto, repetido: false }
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
    const producto = await tx.producto.create({ data: { ...data, organizacionId } })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId, tabla: "productos", rowPk: producto.id, accion: "INSERT", detalle: { nombre: producto.nombre, tipo: producto.tipo } } })
    return producto
  })
}

export async function crearLote(ctx: AuthContext, productoId: string, raw: unknown) {
  const v = loteSchema.parse(raw)
  return prisma.$transaction(async (tx) => {
    const producto = await productoEditable(tx, ctx, productoId)
    if (v.proveedorId && !await tx.proveedor.findFirst({ where: { id: v.proveedorId, organizacionId: producto.organizacionId! }, select: { id: true } })) {
      throw new InventarioError("Proveedor no encontrado en la organización", 404)
    }
    const lote = await tx.loteProducto.create({
      data: { productoId, nroLote: v.nroLote, vencimiento: v.vencimiento ? new Date(`${v.vencimiento}T00:00:00Z`) : null, proveedor: v.proveedor, proveedorId: v.proveedorId, cantidad: v.cantidad, unidad: v.unidad, costo: v.costo },
    })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: producto.organizacionId, tabla: "lotes_producto", rowPk: lote.id, accion: "INSERT", detalle: { productoId, nroLote: lote.nroLote } } })
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
