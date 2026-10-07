import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { MapError, mapResult } from "@/lib/mapa/api"
import { versionesDeLimites } from "@/lib/mapa/historial"

// GET /api/sectores/[id]/historial — versiones del límite dibujado, reconstruidas
// desde la auditoría (geometría anterior y nueva de cada cambio). Más reciente primero.
export const GET = withAuth(async (_request, ctx) => mapResult(async () => {
  const id = z.string().uuid().parse(ctx.params.id)
  const sector = await prisma.sector.findFirst({ where: { id, establecimientoId: { in: ctx.establecimientoIds } }, select: { id: true, geometria: true } })
  if (!sector) throw new MapError("Sector no encontrado", 404)
  const filas = await prisma.auditLog.findMany({
    where: { tabla: "sectores", rowPk: id, accion: "UPDATE" },
    select: { id: true, fecha: true, detalle: true, usuario: { select: { nombre: true, apellido: true } } },
    orderBy: { fecha: "asc" },
    take: 200,
  })
  return NextResponse.json({ success: true, data: versionesDeLimites(filas, sector.geometria) })
}))
