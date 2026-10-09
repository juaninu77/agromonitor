import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { registrarCompra } from "@/lib/inventario/compras"
import { respuestaError } from "@/lib/inventario/service"

/** Compra de un insumo: lote nuevo con proveedor y costo, y egreso opcional en Finanzas. */
export const POST = withAuth(async (request, ctx) => {
  try {
    const data = await registrarCompra(ctx, await request.json())
    return NextResponse.json({ success: true, data }, { status: data.repetido ? 200 : 201 })
  } catch (error) {
    const r = respuestaError(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de inventario (compras):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
