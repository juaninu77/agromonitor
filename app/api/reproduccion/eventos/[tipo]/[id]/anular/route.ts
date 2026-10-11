import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { anularEvento } from "@/lib/reproduccion/service"
import { respuestaError } from "@/lib/reproduccion/respuesta"
import { TIPOS_EVENTO } from "@/lib/reproduccion/validation"

const params = z.object({ tipo: z.enum(TIPOS_EVENTO, { errorMap: () => ({ message: "Tipo de evento inválido" }) }), id: z.string().uuid("Evento inválido") })

// POST /api/reproduccion/eventos/[tipo]/[id]/anular — { motivo, aceptarCria? } (admin/encargado del campo)
export const POST = withAuth(async (request, ctx) => {
  try {
    const { tipo, id } = params.parse(ctx.params)
    return NextResponse.json({ success: true, data: await anularEvento(ctx, tipo, id, await request.json()) })
  } catch (error) {
    return respuestaError(error, "anular evento")
  }
})
