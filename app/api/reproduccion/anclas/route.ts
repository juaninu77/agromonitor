import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { anclasSugeridas } from "@/lib/reproduccion/informes"
import { respuestaError } from "@/lib/reproduccion/respuesta"

const consulta = z.object({
  establecimientoId: z.string().uuid("Campo inválido"),
  anio: z.coerce.number().int().min(2000).max(2100),
  loteId: z.string().uuid().optional(),
  especie: z.string().trim().max(30).optional(),
})

// GET /api/reproduccion/anclas?establecimientoId=&anio=&loteId=&especie= — inicio de servicio y destete sugeridos para el plan sanitario
export const GET = withAuth(async (request, ctx) => {
  try {
    const q = consulta.parse(Object.fromEntries(request.nextUrl.searchParams))
    return NextResponse.json({ success: true, data: await anclasSugeridas(ctx, q.establecimientoId, q.anio, q.loteId, q.especie) })
  } catch (error) {
    return respuestaError(error, "anclas sugeridas")
  }
})
