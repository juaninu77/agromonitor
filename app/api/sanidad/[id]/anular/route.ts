import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { anularSanidad, errorSanidad } from "@/lib/sanidad/service"

// POST /api/sanidad/[id]/anular — anula el tratamiento (o toda la aplicación masiva) y devuelve el stock
export const POST = withAuth(async (request, ctx) => {
  try {
    const data = await anularSanidad(ctx, ctx.params.id, await request.json())
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (anular):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
