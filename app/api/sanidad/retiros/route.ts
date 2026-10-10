import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { animalesBajoRetiro, errorSanidad } from "@/lib/sanidad/service"

// GET /api/sanidad/retiros?establecimientoId= — animales activos bajo retiro (carencia)
export const GET = withAuth(async (request, ctx) => {
  try {
    const data = await animalesBajoRetiro(ctx, Object.fromEntries(request.nextUrl.searchParams))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (retiros):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
