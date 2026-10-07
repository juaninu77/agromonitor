import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { mapBody, mapResult } from "@/lib/mapa/api"
import { trasladarAnimales } from "@/lib/mapa/traslado"

// POST /api/mapa/traslados — trasladar animales a otro campo de la misma organización
export const POST = withAuth(async (request, ctx) => mapResult(async () => {
  const data = await trasladarAnimales(await mapBody(request), ctx)
  return NextResponse.json({ success: true, data }, { status: 201 })
}))
