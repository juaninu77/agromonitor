import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { errorSanidad } from "@/lib/sanidad/service"
import { editarProtocolo } from "@/lib/sanidad/protocolos"

// PATCH /api/sanidad/protocolos/[id] — datos, activo e ítems del protocolo
export const PATCH = withAuth(async (request, ctx) => {
  try {
    const data = await editarProtocolo(ctx, ctx.params.id, await request.json())
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (editar protocolo):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
