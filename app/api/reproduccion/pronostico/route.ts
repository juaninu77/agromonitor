import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { pronosticoPartos } from "@/lib/reproduccion/informes"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/pronostico?establecimientoId= — preñadas sin parir por mes de parto previsto
export const GET = withAuth(async (request, ctx) => {
  try {
    const est = z.string().uuid("Campo inválido").parse(request.nextUrl.searchParams.get("establecimientoId"))
    return NextResponse.json({ success: true, data: await pronosticoPartos(ctx, est) })
  } catch (error) {
    return respuestaError(error, "pronóstico de partos")
  }
})
