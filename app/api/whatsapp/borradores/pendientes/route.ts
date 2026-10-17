import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { contarPorValidar } from "@/lib/whatsapp/borradores"

// GET /api/whatsapp/borradores/pendientes?establecimientoId= — cuántas cargas esperan validación
// (tarjeta del Panel). 0 si el usuario no valida en ese campo.
export const GET = withAuth(async (request, ctx) => {
  const establecimientoId = request.nextUrl.searchParams.get("establecimientoId") ?? undefined
  return NextResponse.json({ data: { cantidad: await contarPorValidar(ctx, establecimientoId) } })
})
