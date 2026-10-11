import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { errorSanidad } from "@/lib/sanidad/service"
import { tareasDelPlan } from "@/lib/sanidad/calendario"

const filtros = z.object({
  establecimientoId: z.string().uuid(),
  estado: z.enum(["pendientes", "vencidas", "todas"]).default("pendientes"),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limite: z.coerce.number().int().min(1).max(500).optional(),
})

// GET /api/sanidad/plan?establecimientoId=&estado=pendientes|vencidas|todas&desde=&hasta= — tareas del plan sanitario
export const GET = withAuth(async (request, ctx) => {
  try {
    const data = await tareasDelPlan(ctx, filtros.parse(Object.fromEntries(request.nextUrl.searchParams)))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const r = errorSanidad(error)
    if (r) return NextResponse.json(r.body, { status: r.status })
    console.error("Error de sanidad (plan):", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
})
