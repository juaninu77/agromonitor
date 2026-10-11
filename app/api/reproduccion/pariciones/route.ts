import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { listarPariciones, registrarParicion } from "@/lib/reproduccion/service"
import { respuestaError } from "@/lib/reproduccion/respuesta"

// GET /api/reproduccion/pariciones?establecimientoId=&page=&limit=&q=&desde=&hasta=… — pariciones del campo, paginados
export const GET = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, ...(await listarPariciones(ctx, Object.fromEntries(request.nextUrl.searchParams))) })
  } catch (error) {
    return respuestaError(error, "listar pariciones")
  }
})

// POST /api/reproduccion/pariciones — permisos por campo, reglas y auditoría en lib/reproduccion/service.ts
export const POST = withAuth(async (request, ctx) => {
  try {
    return NextResponse.json({ success: true, data: await registrarParicion(ctx, await request.json()) }, { status: 201 })
  } catch (error) {
    return respuestaError(error, "registrar pariciones")
  }
})
