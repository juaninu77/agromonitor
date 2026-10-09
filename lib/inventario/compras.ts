// Compra de insumos: entra al stock como un lote nuevo (proveedor, costo por unidad y
// moneda) y, si se indica la cuenta, genera el egreso en Finanzas en la misma transacción.
// La entrada queda con origenTipo "compra" y origenId = id del egreso (o null sin egreso).

import { Prisma } from "@prisma/client"
import { galponEditable, InventarioError, productoEditable } from "./service"
import { compraSchema } from "./validation"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"

const ROLES_ESCRITURA = ["admin", "encargado"] as const

/** Categoría del egreso en Finanzas según el tipo de insumo. */
export function categoriaEgreso(tipo: string): string {
  if (["alimento", "mineral", "suplemento"].includes(tipo)) return "alimentacion"
  if (["vacuna", "antiparasitario", "antibiotico", "antiinflamatorio", "vitaminico"].includes(tipo)) return "sanidad"
  if (["semilla", "fertilizante", "agroquimico"].includes(tipo)) return "semillas_agroquimicos"
  if (["combustible", "lubricante"].includes(tipo)) return "combustible"
  if (["repuesto", "herramienta"].includes(tipo)) return "mantenimiento"
  return "otros_egresos"
}

export async function registrarCompra(ctx: AuthContext, raw: unknown) {
  const v = compraSchema.parse(raw)
  const cantidad = new Prisma.Decimal(v.cantidad)
  const total = new Prisma.Decimal(v.costoTotal).toDecimalPlaces(2)
  return prisma.$transaction(async (tx) => {
    const producto = await productoEditable(tx, ctx, v.productoId)
    const org = producto.organizacionId!
    // Reintento con la misma clave: devuelve la compra ya registrada
    const prior = await tx.movimientoStock.findUnique({ where: { clave: v.clave }, include: { loteProducto: true } })
    if (prior) {
      if (prior.productoId !== v.productoId || prior.origenTipo !== "compra" || !prior.cantidad.equals(cantidad)) throw new InventarioError("La clave de operación ya fue utilizada con otros datos", 409)
      return { lote: prior.loteProducto, movimiento: prior, egresoId: prior.origenId, repetido: true }
    }
    if (!producto.activo) throw new InventarioError("El producto está archivado: reactivalo para registrar compras")

    const proveedor = v.proveedorId ? await tx.proveedor.findFirst({ where: { id: v.proveedorId, organizacionId: org }, select: { id: true, nombre: true, cuit: true } }) : null
    if (v.proveedorId && !proveedor) throw new InventarioError("Proveedor no encontrado en la organización", 404)
    const galpon = await galponEditable(tx, ctx, v.sectorId, org)

    const nroLote = v.nroLote ?? `Compra ${v.fecha}`
    if (await tx.loteProducto.findFirst({ where: { productoId: v.productoId, nroLote: { equals: nroLote, mode: "insensitive" } }, select: { id: true } })) {
      throw new InventarioError(`Ya existe el lote ${nroLote} de este producto: usá otro número de lote`, 409)
    }

    // Egreso en Finanzas: cuenta de un campo de la organización donde el usuario gestiona, activa y en la misma moneda
    let egresoId: string | null = null
    if (v.egreso) {
      const cuenta = await tx.cuentaFinanciera.findFirst({
        where: { id: v.egreso.cuentaId, establecimientoId: { in: ctx.establecimientoIdsConRol([...ROLES_ESCRITURA]) } },
        select: { id: true, nombre: true, activa: true, moneda: true, establecimientoId: true },
      })
      if (!cuenta || ctx.organizacionDeEstablecimiento[cuenta.establecimientoId] !== org) throw new InventarioError("La cuenta no es de un campo de la organización del producto", 400)
      if (!cuenta.activa) throw new InventarioError(`La cuenta «${cuenta.nombre}» está desactivada`, 400)
      if (cuenta.moneda !== v.moneda) throw new InventarioError(`La compra es en ${v.moneda} y la cuenta «${cuenta.nombre}» en ${cuenta.moneda}: elegí una cuenta de la misma moneda`, 400)
      const egreso = await tx.movimientoFinanciero.create({
        data: {
          establecimientoId: cuenta.establecimientoId, cuentaId: cuenta.id, tipo: "egreso", categoria: categoriaEgreso(producto.tipo),
          fecha: new Date(`${v.fecha}T00:00:00Z`), importe: total,
          descripcion: `Compra ${producto.nombre} · ${cantidad.toNumber().toLocaleString("es-AR")} ${producto.unidad}`.slice(0, 180),
          contraparte: proveedor?.nombre ?? null, cuit: proveedor?.cuit ?? null, medioPago: v.egreso.medioPago,
          notas: [v.comprobante && `Comprobante ${v.comprobante}`, v.notas].filter(Boolean).join(" · ") || null,
          creadoPorId: ctx.userId,
        },
      })
      egresoId = egreso.id
      await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: org, tabla: "movimientos_financieros", rowPk: egreso.id, accion: "INSERT", detalle: { tipo: "egreso", categoria: egreso.categoria, importe: total.toNumber(), cuentaId: cuenta.id, origen: "compra_insumo" } } })
    }

    const lote = await tx.loteProducto.create({
      data: {
        productoId: v.productoId, nroLote, vencimiento: v.vencimiento ? new Date(`${v.vencimiento}T00:00:00Z`) : null,
        proveedor: proveedor?.nombre ?? null, proveedorId: proveedor?.id ?? null, cantidad, unidad: producto.unidad,
        // Costo por unidad del producto
        costo: total.dividedBy(cantidad).toDecimalPlaces(2), moneda: v.moneda,
      },
    })
    const movimiento = await tx.movimientoStock.create({
      data: {
        productoId: v.productoId, loteProductoId: lote.id, sectorId: galpon?.id ?? null, tipo: "entrada", cantidad,
        motivo: `Compra${proveedor ? ` a ${proveedor.nombre}` : ""}${v.comprobante ? ` · ${v.comprobante}` : ""}`.slice(0, 1000),
        fecha: new Date(`${v.fecha}T12:00:00-03:00`), clave: v.clave, origenTipo: "compra", origenId: egresoId,
      },
    })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: org, tabla: "movimientos_stock", rowPk: movimiento.id, accion: "INSERT", detalle: { productoId: v.productoId, loteProductoId: lote.id, tipo: "entrada", cantidad: cantidad.toNumber(), costoTotal: total.toNumber(), moneda: v.moneda, egresoId } } })
    return { lote, movimiento, egresoId, repetido: false }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
}
