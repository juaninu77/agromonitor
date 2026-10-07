import { NextResponse } from "next/server"
import { scopeOrganizacion } from "@/lib/api/tenant"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { decimalToNumber } from "@/lib/api/serialize"
import { filtroUbicacion } from "@/lib/inventario/ubicacion"

const STOCK_BAJO_UMBRAL = 10
const DIAS_VENCIMIENTO_ALERTA = 30

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const tipoFilter = searchParams.get("tipo")
    const searchFilter = searchParams.get("search")
    // Ubicación: el stock se calcula solo con los movimientos de ese galpón (o sin galpón)
    const ubicacion = filtroUbicacion(searchParams.get("ubicacion"), ctx.establecimientoIds)

    const whereProducto: Record<string, unknown> = {
      ...scopeOrganizacion(ctx.organizacionIds),
    }

    if (tipoFilter) {
      whereProducto.tipo = tipoFilter
    }

    if (searchFilter) {
      whereProducto.OR = [
        { nombre: { contains: searchFilter, mode: "insensitive" } },
        { principioActivo: { contains: searchFilter, mode: "insensitive" } },
        { laboratorio: { contains: searchFilter, mode: "insensitive" } },
      ]
    }

    const productos = await prisma.producto.findMany({
      where: whereProducto as any,
      include: {
        lotes: {
          orderBy: { vencimiento: "asc" },
        },
        movimientosStock: ubicacion ? { where: ubicacion as never } : true,
      },
      orderBy: { nombre: "asc" },
    })

    const hoy = new Date()
    const limiteVencimiento = new Date()
    limiteVencimiento.setDate(hoy.getDate() + DIAS_VENCIMIENTO_ALERTA)

    const productosConStock = productos.filter((p) => !ubicacion || p.movimientosStock.length > 0).map((producto) => {
      let stockTotal = 0
      for (const mov of producto.movimientosStock) {
        if (mov.tipo === "entrada") {
          stockTotal += mov.cantidad
        } else if (mov.tipo === "salida") {
          stockTotal -= mov.cantidad
        } else if (mov.tipo === "ajuste") {
          stockTotal += mov.cantidad
        }
      }

      const lotesConAlerta = producto.lotes.map((lote) => {
        const proximoAVencer =
          lote.vencimiento !== null && lote.vencimiento <= limiteVencimiento
        const vencido = lote.vencimiento !== null && lote.vencimiento < hoy

        return {
          id: lote.id,
          nroLote: lote.nroLote,
          vencimiento: lote.vencimiento?.toISOString() ?? null,
          proveedor: lote.proveedor,
          cantidad: lote.cantidad,
          unidad: lote.unidad,
          costo: decimalToNumber(lote.costo),
          proximoAVencer,
          vencido,
        }
      })

      const stockBajo = stockTotal < STOCK_BAJO_UMBRAL
      const tieneVencimientoProximo = lotesConAlerta.some(
        (l) => l.proximoAVencer
      )

      return {
        id: producto.id,
        nombre: producto.nombre,
        tipo: producto.tipo,
        principioActivo: producto.principioActivo,
        laboratorio: producto.laboratorio,
        retiroDias: producto.retiroDias,
        dosisReferencia: producto.dosisReferencia,
        notas: producto.notas,
        stockTotal: Math.round(stockTotal * 100) / 100,
        stockBajo,
        tieneVencimientoProximo,
        lotes: lotesConAlerta,
      }
    })

    const totalProductos = productosConStock.length
    const productosStockBajo = productosConStock.filter((p) => p.stockBajo)
    const productosConVencimiento = productosConStock.filter(
      (p) => p.tieneVencimientoProximo
    )

    const ubicaciones = await prisma.sector.findMany({
      where: { establecimientoId: { in: ctx.establecimientoIds }, tipo: "galpon", activo: true },
      select: { id: true, nombre: true, establecimiento: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    })

    const tiposUnicos = [
      ...new Set(productos.map((p) => p.tipo)),
    ].sort()

    return NextResponse.json({
      success: true,
      data: productosConStock,
      resumen: {
        totalProductos,
        productosStockBajo: productosStockBajo.length,
        productosConVencimientoProximo: productosConVencimiento.length,
        umbralStockBajo: STOCK_BAJO_UMBRAL,
        diasAlertaVencimiento: DIAS_VENCIMIENTO_ALERTA,
      },
      tiposDisponibles: tiposUnicos,
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
