import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { indicadoresReproductivos } from "@/lib/reproduccion/indicadores"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/indicadores?establecimientoId= — KPIs por torada/encarnerada (spec 03 §3.5)
export const GET = withAuth(async (request, ctx) => {
  try {
    const establecimientoId = z.string().uuid("Campo inválido").parse(request.nextUrl.searchParams.get("establecimientoId"))
    return NextResponse.json({ success: true, data: await indicadoresReproductivos(ctx, establecimientoId) })
  } catch (error) {
    return respuestaError(error, "indicadores")
  }
})
