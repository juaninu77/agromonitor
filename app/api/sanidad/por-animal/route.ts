import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { errorSanidad, sanidadPorAnimal } from "@/lib/sanidad/service"

// GET /api/sanidad/por-animal?establecimientoId=&page=&limit= — animales con tratamientos
export const GET = withAuth(async (request, ctx) => {
  try {
    const data = await sanidadPorAnimal(ctx, Object.fromEntries(request.nextUrl.searchParams))
    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error en sanidad por animal:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
