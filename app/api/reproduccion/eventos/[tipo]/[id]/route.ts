import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { editarEvento } from "@/lib/reproduccion/service"
import { respuestaError } from "@/lib/reproduccion/respuesta"
import { TIPOS_EVENTO } from "@/lib/reproduccion/validation"

const params = z.object({ tipo: z.enum(TIPOS_EVENTO, { errorMap: () => ({ message: "Tipo de evento inválido" }) }), id: z.string().uuid("Evento inválido") })

// PATCH /api/reproduccion/eventos/[tipo]/[id] — datos no críticos (observaciones, veterinario, tipo de parto…)
export const PATCH = withAuth(async (request, ctx) => {
  try {
    const { tipo, id } = params.parse(ctx.params)
    return NextResponse.json({ success: true, data: await editarEvento(ctx, tipo, id, await request.json()) })
  } catch (error) {
    return respuestaError(error, "editar evento")
  }
})
