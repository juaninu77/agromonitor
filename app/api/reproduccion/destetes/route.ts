import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { listarDestetes, registrarDestete } from "@/lib/reproduccion/service"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/destetes?establecimientoId=&page=&limit=&q=&desde=&hasta=… — destetes del campo, paginados
export const GET = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, ...(await listarDestetes(ctx, Object.fromEntries(request.nextUrl.searchParams))) })
  } catch (error) {
    return respuestaError(error, "listar destetes")
  }
})

// POST /api/reproduccion/destetes — permisos por campo, reglas y auditoría en lib/reproduccion/service.ts
export const POST = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await registrarDestete(ctx, await request.json()) }, { status: 201 })
  } catch (error) {
    return respuestaError(error, "registrar destetes")
  }
})
