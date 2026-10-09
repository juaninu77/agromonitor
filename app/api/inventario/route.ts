import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { z } from "zod"
import { scopeOrganizacion } from "@/lib/api/tenant"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { decimalToNumber } from "@/lib/api/serialize"
import { filtroUbicacion } from "@/lib/inventario/ubicacion"
import { estadoVencimiento, hoyArgentina } from "@/lib/inventario/fechas"
import { orgsEscritura } from "@/lib/inventario/service"
import { aNumero, CERO, saldosPorLote, saldosPorProducto } from "@/lib/inventario/stock"

const DIAS_VENCIMIENTO_ALERTA = 30
const query = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  archivados: z.enum(["1", "0"]).optional(),
})

/**
 * Stock por producto calculado en SQL (groupBy), con saldo por lote.
 * - "Stock bajo" usa el mínimo de cada producto; sin mínimo no hay alerta.
 * - Un lote solo alerta por vencimiento si todavía tiene saldo.
 */
export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const q = query.safeParse(Object.fromEntries(searchParams))
    if (!q.success) return NextResponse.json({ success: false, error: "Parámetros inválidos" }, { status: 400 })
    const tipoFilter = searchParams.get("tipo")
    const searchFilter = searchParams.get("search")?.slice(0, 120)
    // Ubicación: el stock se calcula solo con los movimientos de ese galpón (o sin galpón)
    const ubicacion = filtroUbicacion(searchParams.get("ubicacion"), ctx.establecimientoIds) as Prisma.MovimientoStockWhereInput | null

    const whereProducto: Prisma.ProductoWhereInput = {
      ...scopeOrganizacion(ctx.organizacionIds),
      ...(q.data.archivados === "1" ? {} : { activo: true }),
      ...(tipoFilter ? { tipo: tipoFilter } : {}),
      ...(searchFilter
        ? { OR: [
            { nombre: { contains: searchFilter, mode: "insensitive" } },
            { principioActivo: { contains: searchFilter, mode: "insensitive" } },
            { laboratorio: { contains: searchFilter, mode: "insensitive" } },
          ] }
        : {}),
    }

    const productos = await prisma.producto.findMany({
      where: whereProducto,
      include: { lotes: { orderBy: [{ vencimiento: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] } },
      orderBy: { nombre: "asc" },
    })
    const ids = productos.map((p) => p.id)
    const [saldos, { porLote }, ubicGroup] = await Promise.all([
      saldosPorProducto(prisma, ids, ubicacion ?? {}),
      saldosPorLote(prisma, ids, ubicacion ?? {}),
      // Saldo de cada producto por ubicación (galpón o "sin"), para elegir de dónde sale o se transfiere
      ids.length ? prisma.movimientoStock.groupBy({ by: ["productoId", "sectorId", "tipo"], where: { productoId: { in: ids } }, _sum: { cantidad: true } }) : [],
    ])
    const porUbicacion = new Map<string, Record<string, number>>()
    for (const g of ubicGroup) {
      const m = porUbicacion.get(g.productoId) ?? {}
      const k = g.sectorId ?? "sin"
      const v = Number(g._sum.cantidad ?? 0) * (g.tipo === "salida" ? -1 : 1)
      m[k] = Math.round(((m[k] ?? 0) + v) * 1000) / 1000
      porUbicacion.set(g.productoId, m)
    }
    const hoy = hoyArgentina()

    const productosConStock = productos
      // Con ubicación elegida, solo los productos que tuvieron movimientos ahí
      .filter((p) => !ubicacion || saldos.has(p.id))
      .map((producto) => {
        const stock = saldos.get(producto.id) ?? CERO
        const lotes = producto.lotes.map((lote) => {
          const saldo = porLote.get(lote.id) ?? CERO
          const venc = estadoVencimiento(lote.vencimiento, { hoy, diasAlerta: DIAS_VENCIMIENTO_ALERTA })
          const conSaldo = saldo.gt(0)
          return {
            id: lote.id,
            nroLote: lote.nroLote,
            vencimiento: lote.vencimiento?.toISOString() ?? null,
            proveedor: lote.proveedor,
            cantidad: aNumero(lote.cantidad),
            saldo: aNumero(saldo)!,
            unidad: lote.unidad ?? producto.unidad,
            costo: decimalToNumber(lote.costo),
            proximoAVencer: conSaldo && venc.proximoAVencer,
            vencido: conSaldo && venc.vencido,
            diasRestantes: venc.diasRestantes,
          }
        })
        const minimo = producto.stockMinimo
        return {
          id: producto.id,
          organizacionId: producto.organizacionId,
          nombre: producto.nombre,
          tipo: producto.tipo,
          principioActivo: producto.principioActivo,
          laboratorio: producto.laboratorio,
          retiroDias: producto.retiroDias,
          dosisReferencia: producto.dosisReferencia,
          notas: producto.notas,
          unidad: producto.unidad,
          stockMinimo: aNumero(minimo),
          costoReferencia: decimalToNumber(producto.costoReferencia),
          monedaCosto: producto.monedaCosto,
          activo: producto.activo,
          stockTotal: aNumero(stock)!,
          porUbicacion: Object.fromEntries(Object.entries(porUbicacion.get(producto.id) ?? {}).filter(([, n]) => n !== 0)),
          stockBajo: minimo != null && stock.lte(minimo),
          tieneVencimientoProximo: lotes.some((l) => l.proximoAVencer),
          lotes,
        }
      })

    const ubicaciones = await prisma.sector.findMany({
      where: { establecimientoId: { in: ctx.establecimientoIds }, tipo: "galpon", activo: true },
      select: { id: true, nombre: true, establecimiento: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    })
    const { page, limit } = q.data
    const total = productosConStock.length

    return NextResponse.json({
      success: true,
      data: productosConStock.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      resumen: {
        totalProductos: total,
        productosStockBajo: productosConStock.filter((p) => p.stockBajo).length,
        productosConVencimientoProximo: productosConStock.filter((p) => p.tieneVencimientoProximo).length,
        productosSinMinimo: productosConStock.filter((p) => p.stockMinimo == null).length,
        diasAlertaVencimiento: DIAS_VENCIMIENTO_ALERTA,
      },
      tiposDisponibles: [...new Set(productos.map((p) => p.tipo))].sort(),
      puedeEditar: orgsEscritura(ctx).length > 0,
      organizacionesEditables: orgsEscritura(ctx),
      ubicaciones: ubicaciones.map((u) => ({ id: u.id, nombre: u.nombre, campo: u.establecimiento.nombre })),
    })
  } catch (error) {
    console.error("Error al obtener inventario:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})
