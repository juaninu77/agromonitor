import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { detalleProtocoloIatf } from "@/lib/reproduccion/iatf"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/iatf/[id] — el protocolo con sus hembras
export const GET = withAuth(async (_request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await detalleProtocoloIatf(ctx, z.string().uuid("Protocolo inválido").parse(ctx.params.id)) })
  } catch (error) {
    return respuestaError(error, "protocolo IATF")
  }
})
