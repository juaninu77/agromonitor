import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { hembrasDeTorada } from "@/lib/reproduccion/grupos"
import { respuestaError } from "@/lib/reproduccion/respuesta"

const consulta = z.object({ id: z.string().uuid("Torada inválida"), fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional() })

// GET /api/reproduccion/toradas/[id]/hembras?fecha= — hembras de la torada con su estado (servicio y planilla de tacto)
export const GET = withAuth(async (request, ctx) => {
  try {
    const { id, fecha } = consulta.parse({ id: ctx.params.id, fecha: request.nextUrl.searchParams.get("fecha") ?? undefined })
    return NextResponse.json({ success: true, data: await hembrasDeTorada(ctx, id, fecha) })
  } catch (error) {
    return respuestaError(error, "hembras de la torada")
  }
})
