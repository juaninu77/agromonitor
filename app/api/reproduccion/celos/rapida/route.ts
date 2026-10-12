import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { cargaRapidaCelos } from "@/lib/reproduccion/celo"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// POST /api/reproduccion/celos/rapida — celos por caravana, CUIG o EID; idempotente por `clave`
export const POST = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await cargaRapidaCelos(ctx, await request.json()) }, { status: 201 })
  } catch (error) {
    return respuestaError(error, "registrar celos")
  }
})
