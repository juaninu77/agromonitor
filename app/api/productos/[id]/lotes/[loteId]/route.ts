import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { decimalToNumber } from "@/lib/api/serialize"
import { actualizarLote, respuestaError } from "@/lib/inventario/service"

/** Editar número, vencimiento, proveedor o costo de un lote. */
export const PATCH = withAuth(async (request, ctx) => {
  try {
    const [productoId, loteId] = [z.string().uuid().parse(ctx.params.id), z.string().uuid().parse(ctx.params.loteId)]
    const l = await actualizarLote(ctx, productoId, loteId, await request.json())
    return NextResponse.json({ success: true, data: { ...l, cantidad: decimalToNumber(l.cantidad), costo: decimalToNumber(l.costo) } })
  } catch (error) {
    const r = respuestaError(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error al editar el lote:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
