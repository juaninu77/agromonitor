import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { errorSanidad } from "@/lib/sanidad/service"
import { indicadoresSanitarios } from "@/lib/sanidad/indicadores"

// GET /api/sanidad/indicadores?establecimientoId= — KPIs del plan sanitario (spec 02 §2.10)
export const GET = withAuth(async (request, ctx) => {
  try {
    const data = await indicadoresSanitarios(ctx, request.nextUrl.searchParams.get("establecimientoId") ?? "")
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (indicadores):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
