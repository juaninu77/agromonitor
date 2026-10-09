import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { editarSanidad, errorSanidad } from "@/lib/sanidad/service"

// PATCH /api/sanidad/[id] — edita observaciones, veterinario, aplicador, vía o motivo
export const PATCH = withAuth(async (request, ctx) => {
  try {
    const data = await editarSanidad(ctx, ctx.params.id, await request.json())
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (editar):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
