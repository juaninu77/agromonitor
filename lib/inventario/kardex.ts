// Ficha de un producto: saldos por lote y por galpón, kardex (movimientos con saldo
// acumulado, calculado en SQL con una ventana) y últimas aplicaciones en Sanidad.

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { decimalToNumber } from "@/lib/api/serialize"
import { scopeEventoAnimalOLote } from "@/lib/api/tenant"
import { estadoVencimiento, hoyArgentina } from "./fechas"
import { InventarioError, orgsEscritura } from "./service"
import { valorizarProducto } from "./valorizacion"
import { aNumero, CERO, saldosPorLote, saldosPorProducto } from "./stock"

interface FilaKardex {
  id: string; tipo: string; cantidad: Prisma.Decimal; motivo: string | null; fecha: Date; created_at: Date
  lote_producto_id: string | null; sector_id: string | null; operacion_id: string | null; anula_a_id: string | null; saldo: Prisma.Decimal
}

export async function fichaProducto(ctx: AuthContext, productoId: string, { page = 1, limit = 25 } = {}) {
  const producto = await prisma.producto.findFirst({
    where: { id: productoId, OR: [{ organizacionId: { in: ctx.organizacionIds } }, { organizacionId: null }] },
    include: { lotes: { orderBy: [{ vencimiento: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] } },
  })
  if (!producto) throw new InventarioError("Producto no encontrado", 404)

  const [saldos, { porLote, sinLote }, porGalpon, total, filas, aplicaciones, totalAplicaciones] = await Promise.all([
    saldosPorProducto(prisma, [productoId]),
    saldosPorLote(prisma, [productoId]),
    prisma.movimientoStock.groupBy({ by: ["sectorId", "tipo"], where: { productoId }, _sum: { cantidad: true } }),
    prisma.movimientoStock.count({ where: { productoId } }),
    // Saldo acumulado en orden cronológico; la página se muestra de lo más nuevo a lo más viejo
    prisma.$queryRaw<FilaKardex[]>`
      SELECT id, tipo, cantidad, motivo, fecha, created_at, lote_producto_id, sector_id, operacion_id, anula_a_id,
             SUM(CASE WHEN tipo = 'salida' THEN -cantidad ELSE cantidad END)
               OVER (ORDER BY fecha, created_at, id ROWS UNBOUNDED PRECEDING) AS saldo
      FROM movimientos_stock
      WHERE producto_id = ${productoId}::uuid
      ORDER BY fecha DESC, created_at DESC, id DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    prisma.evtSanidad.findMany({
      where: { productoId, anuladoAt: null, ...scopeEventoAnimalOLote(ctx.establecimientoIds) },
      select: { id: true, fecha: true, dosis: true, unidad: true, cantidadAnimales: true, animal: { select: { caravanaVisual: true } }, lote: { select: { nombre: true } } },
      orderBy: { fecha: "desc" }, take: 10,
    }),
    prisma.evtSanidad.count({ where: { productoId, anuladoAt: null, ...scopeEventoAnimalOLote(ctx.establecimientoIds) } }),
  ])

  // Galpones: solo los de campos a los que accede el usuario; el resto se agrupa
  const sectorIds = [...new Set(porGalpon.map((g) => g.sectorId).filter((x): x is string => !!x))]
  const sectores = sectorIds.length ? await prisma.sector.findMany({ where: { id: { in: sectorIds }, establecimientoId: { in: ctx.establecimientoIds } }, select: { id: true, nombre: true, establecimiento: { select: { nombre: true } } } }) : []
  const nombres = new Map(sectores.map((s) => [s.id, `${s.nombre} · ${s.establecimiento.nombre}`]))
  const ubic = new Map<string, Prisma.Decimal>()
  for (const g of porGalpon) {
    const clave = !g.sectorId ? "Sin galpón asignado" : nombres.get(g.sectorId) ?? "Otros campos"
    ubic.set(clave, (ubic.get(clave) ?? CERO).plus(g.tipo === "salida" ? (g._sum.cantidad ?? CERO).neg() : (g._sum.cantidad ?? CERO)))
  }

  // Movimientos de esta página que ya fueron anulados
  const ids = filas.map((f) => f.id)
  const anulados = new Set(ids.length ? (await prisma.movimientoStock.findMany({ where: { anulaAId: { in: ids } }, select: { anulaAId: true } })).map((a) => a.anulaAId!) : [])
  const lotes = new Map(producto.lotes.map((l) => [l.id, l.nroLote]))
  const hoy = hoyArgentina()
  const editable = !!producto.organizacionId && orgsEscritura(ctx).includes(producto.organizacionId)

  return {
    producto: {
      ...producto, lotes: undefined,
      stockMinimo: aNumero(producto.stockMinimo), costoReferencia: decimalToNumber(producto.costoReferencia),
      esGlobal: !producto.organizacionId,
    },
    puedeEditar: editable,
    // Valor del stock por moneda (solo para quien gestiona la organización)
    valorizacion: editable ? valorizarProducto(producto, porLote, sinLote.get(productoId) ?? CERO) : null,
    stock: aNumero(saldos.get(productoId) ?? CERO)!,
    sinLote: aNumero(sinLote.get(productoId) ?? CERO)!,
    lotes: producto.lotes.map((l) => {
      const saldo = porLote.get(l.id) ?? CERO
      const v = estadoVencimiento(l.vencimiento, { hoy })
      return { id: l.id, nroLote: l.nroLote, vencimiento: l.vencimiento?.toISOString() ?? null, proveedor: l.proveedor, costo: decimalToNumber(l.costo), moneda: l.moneda, cantidadInicial: aNumero(l.cantidad), saldo: aNumero(saldo)!, vencido: saldo.gt(0) && v.vencido, diasRestantes: v.diasRestantes }
    }),
    ubicaciones: [...ubic].map(([nombre, saldo]) => ({ nombre, saldo: aNumero(saldo)! })).filter((u) => u.saldo !== 0),
    kardex: {
      total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)),
      filas: filas.map((f) => ({
        id: f.id, tipo: f.tipo, cantidad: aNumero(f.cantidad)!, motivo: f.motivo, fecha: f.fecha.toISOString(),
        lote: f.lote_producto_id ? lotes.get(f.lote_producto_id) ?? null : null,
        galpon: f.sector_id ? nombres.get(f.sector_id) ?? "Otro campo" : null,
        saldo: aNumero(f.saldo)!, operacionId: f.operacion_id,
        esAnulacion: !!f.anula_a_id, anulado: anulados.has(f.id),
      })),
    },
    aplicaciones: {
      total: totalAplicaciones,
      ultimas: aplicaciones.map((a) => ({ id: a.id, fecha: a.fecha.toISOString(), dosis: a.dosis, unidad: a.unidad, destino: a.animal?.caravanaVisual ?? (a.lote ? `Grupo ${a.lote.nombre}${a.cantidadAnimales ? ` (${a.cantidadAnimales})` : ""}` : "—") })),
    },
  }
}
