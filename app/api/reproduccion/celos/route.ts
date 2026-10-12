import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { listarCelos, registrarCelo } from "@/lib/reproduccion/celo"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/celos?establecimientoId=&page=&limit=&q=… — celos del campo, con intervalo, IA sugerida y servicio
export const GET = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, ...(await listarCelos(ctx, Object.fromEntries(request.nextUrl.searchParams))) })
  } catch (error) {
    return respuestaError(error, "listar celos")
  }
})

// POST /api/reproduccion/celos — un celo de una hembra; devuelve la inseminación sugerida (regla AM/PM)
export const POST = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await registrarCelo(ctx, await request.json()) }, { status: 201 })
  } catch (error) {
    return respuestaError(error, "registrar celos")
  }
})
