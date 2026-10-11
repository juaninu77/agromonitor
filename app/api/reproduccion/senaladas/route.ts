import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { listarSenaladas, registrarSenalada } from "@/lib/reproduccion/grupos"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/senaladas?establecimientoId=&page=&limit= — señaladas del campo con el % señalada
export const GET = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, ...(await listarSenaladas(ctx, Object.fromEntries(request.nextUrl.searchParams))) })
  } catch (error) {
    return respuestaError(error, "listar señaladas")
  }
})

// POST /api/reproduccion/senaladas — señalada de corderos de un grupo (ovinos)
export const POST = withAuth(async (request, ctx) => {
  try {
    const data = await registrarSenalada(ctx, await request.json())
    return NextResponse.json({ success: true, data }, { status: data.repetido ? 200 : 201 })
  } catch (error) {
    return respuestaError(error, "registrar señalada")
  }
})
