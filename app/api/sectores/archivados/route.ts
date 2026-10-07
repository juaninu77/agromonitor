import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { mapField, mapResult } from "@/lib/mapa/api"

// GET /api/sectores/archivados?establecimientoId= — lugares archivados del campo, para restaurarlos
export const GET = withAuth(async (request, ctx) => mapResult(async () => {
  const establecimientoId = mapField(ctx, z.string().uuid().parse(request.nextUrl.searchParams.get("establecimientoId")))
  const data = await prisma.sector.findMany({
    where: { establecimientoId, activo: false },
    select: { id: true, nombre: true, tipo: true, version: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  })
  return NextResponse.json({ success: true, data })
}))
