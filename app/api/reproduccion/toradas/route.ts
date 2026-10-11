import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { listarToradas, crearTorada } from "@/lib/reproduccion/service"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/toradas?establecimientoId=&page=&limit=&q=&desde=&hasta=… — toradas del campo, paginados
export const GET = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, ...(await listarToradas(ctx, Object.fromEntries(request.nextUrl.searchParams))) })
  } catch (error) {
    return respuestaError(error, "listar toradas")
  }
})

// POST /api/reproduccion/toradas — permisos por campo, reglas y auditoría en lib/reproduccion/service.ts
export const POST = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await crearTorada(ctx, await request.json()) }, { status: 201 })
  } catch (error) {
    return respuestaError(error, "registrar toradas")
  }
})
