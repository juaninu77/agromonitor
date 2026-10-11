import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { tactoMasivo } from "@/lib/reproduccion/grupos"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// POST /api/reproduccion/tactos/masivo — planilla de tacto en una operación (todo o nada; la clave hace idempotente el reintento)
export const POST = withAuth(async (request, ctx) => {
  try {
    const data = await tactoMasivo(ctx, await request.json())
    return NextResponse.json({ success: true, data }, { status: data.repetido ? 200 : 201 })
  } catch (error) {
    return respuestaError(error, "planilla de tacto")
  }
})
