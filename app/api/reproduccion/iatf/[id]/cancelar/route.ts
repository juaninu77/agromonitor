import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { cancelarProtocoloIatf } from "@/lib/reproduccion/iatf"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// POST /api/reproduccion/iatf/[id]/cancelar — cancela el protocolo y sus pasos pendientes
export const POST = withAuth(async (_request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await cancelarProtocoloIatf(ctx, z.string().uuid("Protocolo inválido").parse(ctx.params.id)) })
  } catch (error) {
    return respuestaError(error, "cancelar protocolo IATF")
  }
})
