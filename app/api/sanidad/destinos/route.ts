import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { contarDestino, errorSanidad } from "@/lib/sanidad/service"

// GET /api/sanidad/destinos?establecimientoId=&loteId=&especie=&categoriaId=&sectorId= — cuántos animales recibirían la aplicación
export const GET = withAuth(async (request, ctx) => {
  try {
    const data = await contarDestino(ctx, Object.fromEntries(request.nextUrl.searchParams))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (destinos):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
