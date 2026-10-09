import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { respuestaError, registrarRecuento } from "@/lib/inventario/service"

/** Recuento físico: ajusta las diferencias contra el sistema. */
export const POST = withAuth(async (request, ctx) => {
  try {
    const data = await registrarRecuento(ctx, await request.json())
    return NextResponse.json({ success: true, data }, { status: data.repetido ? 200 : 201 })
  } catch (error) {
    const r = respuestaError(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de inventario (recuentos):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
