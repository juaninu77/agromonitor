import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { hojaDeServicio } from "@/lib/reproduccion/informes"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/toradas/[id]/hoja — hoja de servicio de la torada (spec 03 §3.11)
export const GET = withAuth(async (_request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await hojaDeServicio(ctx, z.string().uuid("Torada inválida").parse(ctx.params.id)) })
  } catch (error) {
    return respuestaError(error, "hoja de servicio")
  }
})
