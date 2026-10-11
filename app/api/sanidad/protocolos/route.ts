import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { errorSanidad } from "@/lib/sanidad/service"
import { crearProtocolo, listarProtocolos } from "@/lib/sanidad/protocolos"

// GET /api/sanidad/protocolos?establecimientoId= — protocolos de la organización, plantillas y zona del campo
export const GET = withAuth(async (request, ctx) => {
  try {
    const id = request.nextUrl.searchParams.get("establecimientoId") ?? ""
    return NextResponse.json({ success: true, data: await listarProtocolos(ctx, id) })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (protocolos):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})

// POST /api/sanidad/protocolos — crear (copia de plantilla o vacío)
export const POST = withAuth(async (request, ctx) => {
  try {
    const data = await crearProtocolo(ctx, await request.json())
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (crear protocolo):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
