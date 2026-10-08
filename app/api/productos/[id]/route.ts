import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { decimalToNumber } from "@/lib/api/serialize"
import { configurarProducto, respuestaError } from "@/lib/inventario/service"

/** Configuración de inventario del producto: unidad, stock mínimo, costo de referencia y archivado. */
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
