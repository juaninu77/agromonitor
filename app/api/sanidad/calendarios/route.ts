import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { errorSanidad } from "@/lib/sanidad/service"
import { crearCalendario, listarCalendarios } from "@/lib/sanidad/calendario"

// GET /api/sanidad/calendarios?establecimientoId= — calendarios del campo con su avance
export const GET = withAuth(async (request, ctx) => {
  try {
    const data = await listarCalendarios(ctx, request.nextUrl.searchParams.get("establecimientoId") ?? "")
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (calendarios):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})

// POST /api/sanidad/calendarios — crea el calendario y sus tareas (o vista previa)
export const POST = withAuth(async (request, ctx) => {
  try {
    const data = await crearCalendario(ctx, await request.json())
    return NextResponse.json({ success: true, data }, { status: data.vistaPrevia ? 200 : 201 })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (crear calendario):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
