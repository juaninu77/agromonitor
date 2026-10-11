import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { errorSanidad } from "@/lib/sanidad/service"
import { definirZonaAftosa } from "@/lib/sanidad/protocolos"

// PATCH /api/sanidad/zona — zona de aftosa del campo (admin o encargado)
export const PATCH = withAuth(async (request, ctx) => {
  try {
    const data = await definirZonaAftosa(ctx, await request.json())
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (zona de aftosa):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
