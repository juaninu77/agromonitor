import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { registrarPasoIatf } from "@/lib/reproduccion/iatf"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// POST /api/reproduccion/iatf/[id]/pasos/[paso] — registra el paso (tratamientos en Sanidad e inseminación)
export const POST = withAuth(async (request, ctx) => {
  try {
    const id = z.string().uuid("Protocolo inválido").parse(ctx.params.id)
    const paso = z.coerce.number().int().min(0).max(20).parse(ctx.params.paso)
    return NextResponse.json({ success: true, data: await registrarPasoIatf(ctx, id, paso, await request.json()) }, { status: 201 })
  } catch (error) {
    return respuestaError(error, "registrar paso IATF")
  }
})
