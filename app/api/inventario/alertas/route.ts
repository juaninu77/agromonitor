import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { alertasInventario } from "@/lib/inventario/alertas"

/**
 * Stock bajo y lotes por vencer de la organización del campo activo
 * (o de todas las del usuario si no se indica campo).
 */
export const GET = withAuth(async (request, ctx) => {
  try {
    const estId = request.nextUrl.searchParams.get("establecimientoId")
    const org = estId ? ctx.organizacionDeEstablecimiento[estId] : null
    if (estId && !org) return NextResponse.json({ success: false, error: "Campo no encontrado" }, { status: 404 })
    const data = await alertasInventario(prisma, org ? [org] : ctx.organizacionIds)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error al obtener alertas de inventario:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
