import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { resumenReproduccion } from "@/lib/reproduccion/service"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/resumen?establecimientoId= — KPIs del campo calculados en la base
export const GET = withAuth(async (request, ctx) => {
  try {
    const establecimientoId = z.string().uuid("Campo inválido").parse(request.nextUrl.searchParams.get("establecimientoId"))
    return NextResponse.json({ success: true, data: await resumenReproduccion(ctx, establecimientoId) })
  } catch (error) {
    return respuestaError(error, "resumen")
  }
})
