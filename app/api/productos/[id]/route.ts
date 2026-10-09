import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { decimalToNumber } from "@/lib/api/serialize"
import { configurarProducto, respuestaError } from "@/lib/inventario/service"
import { fichaProducto } from "@/lib/inventario/kardex"

/** Ficha del producto: saldos por lote y galpón, kardex paginado y aplicaciones en Sanidad. */
export const GET = withAuth(async (request, ctx) => {
  try {
    const id = z.string().uuid().parse(ctx.params.id)
    const q = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(5).max(200).default(25) })
      .parse({ page: request.nextUrl.searchParams.get("page") ?? undefined, limit: request.nextUrl.searchParams.get("limit") ?? undefined })
    return NextResponse.json({ success: true, data: await fichaProducto(ctx, id, q) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    const r = respuestaError(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error al obtener la ficha del producto:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})

/** Editar datos y configuración del producto (unidad, mínimo, costo, archivado). */
export const PATCH = withAuth(async (request, ctx) => {
  try {
    const id = z.string().uuid().parse(ctx.params.id)
    const p = await configurarProducto(ctx, id, await request.json())
    return NextResponse.json({ success: true, data: { ...p, stockMinimo: decimalToNumber(p.stockMinimo), costoReferencia: decimalToNumber(p.costoReferencia) } })
  } catch (error) {
    const r = respuestaError(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error al configurar producto:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
