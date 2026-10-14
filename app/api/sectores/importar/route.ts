import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api/with-auth"
import { mapBody, mapResult } from "@/lib/mapa/api"
import { importarLugares } from "@/lib/mapa/importar-lugares"

// Alta en lote de los lugares de un KML/KMZ/GeoJSON (hasta 100 figuras de hasta 500 vértices)
export const POST = withAuth(async (request, ctx) => mapResult(async () => {
  const data = await importarLugares(ctx, await mapBody(request, 4_000_000))
  return NextResponse.json({ success: true, data }, { status: 201 })
}))
