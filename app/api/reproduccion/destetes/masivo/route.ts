import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { desteteMasivo } from "@/lib/reproduccion/grupos"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// POST /api/reproduccion/destetes/masivo — destete por grupo en una operación (todo o nada; la clave hace idempotente el reintento)
export const POST = withAuth(async (request, ctx) => {
  try {
    const data = await desteteMasivo(ctx, await request.json())
    return NextResponse.json({ success: true, data }, { status: data.repetido ? 200 : 201 })
  } catch (error) {
    return respuestaError(error, "destete por grupo")
  }
})
