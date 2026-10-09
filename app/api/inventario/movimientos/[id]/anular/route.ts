import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { anularMovimiento, respuestaError } from "@/lib/inventario/service"

/** Anular un movimiento con su contramovimiento (queda en el historial). */
export const POST = withAuth(async (request, ctx) => {
  try {
    const id = z.string().uuid().parse(ctx.params.id)
    return NextResponse.json({ success: true, data: await anularMovimiento(ctx, id, await request.json()) }, { status: 201 })
  } catch (error) {
    const r = respuestaError(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error al anular el movimiento:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
