import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { errorSanidad, resumenSanidad } from "@/lib/sanidad/service"

// GET /api/sanidad/resumen?establecimientoId=&mes=AAAA-MM — indicadores del mes y calendario
export const GET = withAuth(async (request, ctx) => {
  try {
    const data = await resumenSanidad(ctx, Object.fromEntries(request.nextUrl.searchParams))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error en el resumen sanitario:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
