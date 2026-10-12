import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { desempenoPorToro } from "@/lib/reproduccion/toros"
import { respuestaError } from "@/lib/reproduccion/respuesta"
import { hoyArgentina } from "@/lib/inventario/fechas"

const filtros = z.object({
  establecimientoId: z.string({ required_error: "Falta el campo" }).uuid("Campo inválido"),
  anio: z.coerce.number().int().min(2000).max(2100).default(() => Number(hoyArgentina().slice(0, 4))),
  toradaId: z.string().uuid().optional(),
})

// GET /api/reproduccion/toros?establecimientoId=&anio=&toradaId= — desempeño por toro o semen del año
export const GET = withAuth(async (request, ctx) => {
  try {
    const f = filtros.parse(Object.fromEntries(request.nextUrl.searchParams))
    return NextResponse.json({ success: true, data: await desempenoPorToro(ctx, f.establecimientoId, f.anio, f.toradaId) })
  } catch (error) {
    return respuestaError(error, "desempeño por toro")
  }
})
