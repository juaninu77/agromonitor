import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { mapField, mapResult } from "@/lib/mapa/api"
import { fieldSectors } from "@/lib/mapa/sector-data"
export const GET = withAuth(async (request, ctx) => mapResult(async () => {
  const id = mapField(ctx, z.string().uuid().parse(request.nextUrl.searchParams.get("establecimientoId")))
  return NextResponse.json({ data: await fieldSectors([id]), puedeEditar: ctx.establecimientoIdsConRol(["admin", "encargado"]).includes(id) }, { headers: { "Cache-Control": "private, no-store" } })
}))
