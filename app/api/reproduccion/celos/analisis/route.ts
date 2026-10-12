import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { analisisCelos } from "@/lib/reproduccion/celo"
import { respuestaError } from "@/lib/reproduccion/respuesta"

const query = z.object({ establecimientoId: z.string({ required_error: "Falta el campo" }).uuid("Campo inválido") })

// GET /api/reproduccion/celos/analisis?establecimientoId= — para inseminar, intervalos irregulares y hembras sin celo
export const GET = withAuth(async (request, ctx) => {
  try {
    const { establecimientoId } = query.parse(Object.fromEntries(request.nextUrl.searchParams))
    return NextResponse.json({ success: true, data: await analisisCelos(ctx, establecimientoId) })
  } catch (error) {
    return respuestaError(error, "analizar celos")
  }
})
