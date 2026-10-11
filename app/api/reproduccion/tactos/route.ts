import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { listarTactos, registrarTacto } from "@/lib/reproduccion/service"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/tactos?establecimientoId=&page=&limit=&q=&desde=&hasta=… — tactos del campo, paginados
export const GET = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, ...(await listarTactos(ctx, Object.fromEntries(request.nextUrl.searchParams))) })
  } catch (error) {
    return respuestaError(error, "listar tactos")
  }
})

// POST /api/reproduccion/tactos — permisos por campo, reglas y auditoría en lib/reproduccion/service.ts
export const POST = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await registrarTacto(ctx, await request.json()) }, { status: 201 })
  } catch (error) {
    return respuestaError(error, "registrar tactos")
  }
})
