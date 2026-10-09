import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { aplicarMasivo, errorSanidad } from "@/lib/sanidad/service"

// POST /api/sanidad/masiva — aplicación a muchos animales en una sola operación (idempotente por clave)
export const POST = withAuth(async (request, ctx) => {
  try {
    const data = await aplicarMasivo(ctx, await request.json())
    return NextResponse.json({ success: true, data }, { status: data.repetido ? 200 : 201 })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (masiva):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
