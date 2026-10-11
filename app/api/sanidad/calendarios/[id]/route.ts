import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { errorSanidad } from "@/lib/sanidad/service"
import { desactivarCalendario } from "@/lib/sanidad/calendario"

// DELETE /api/sanidad/calendarios/[id] — desactiva el calendario (no borra): cancela sus tareas pendientes
export const DELETE = withAuth(async (_request, ctx) => {
  try {
    const data = await desactivarCalendario(ctx, ctx.params.id)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (desactivar calendario):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
