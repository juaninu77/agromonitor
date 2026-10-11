import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { buscarAnimales } from "@/lib/reproduccion/service"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/animales?establecimientoId=&sexo=&especieId=&q= — animales activos para los selectores
export const GET = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await buscarAnimales(ctx, Object.fromEntries(request.nextUrl.searchParams)) })
  } catch (error) {
    return respuestaError(error, "buscar animales")
  }
})
