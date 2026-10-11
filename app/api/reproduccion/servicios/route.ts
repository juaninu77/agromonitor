import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { listarServicios, registrarServicio } from "@/lib/reproduccion/service"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/servicios?establecimientoId=&page=&limit=&q=&desde=&hasta=… — servicios del campo, paginados
export const GET = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, ...(await listarServicios(ctx, Object.fromEntries(request.nextUrl.searchParams))) })
  } catch (error) {
    return respuestaError(error, "listar servicios")
  }
})

// POST /api/reproduccion/servicios — permisos por campo, reglas y auditoría en lib/reproduccion/service.ts
export const POST = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await registrarServicio(ctx, await request.json()) }, { status: 201 })
  } catch (error) {
    return respuestaError(error, "registrar servicios")
  }
})
