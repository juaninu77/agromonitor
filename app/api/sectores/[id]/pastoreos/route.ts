import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { MapError, mapResult } from "@/lib/mapa/api"

const DIA = 86_400_000

// GET /api/sectores/[id]/pastoreos — historial de rotación del lugar (más reciente primero)
export const GET = withAuth(async (request, ctx) => mapResult(async () => {
  const id = z.string().uuid().parse(ctx.params.id)
  const limit = z.coerce.number().int().min(1).max(100).catch(30).parse(request.nextUrl.searchParams.get("limit") ?? 30)
  const sector = await prisma.sector.findFirst({ where: { id, establecimientoId: { in: ctx.establecimientoIds } }, select: { id: true } })
  if (!sector) throw new MapError("Sector no encontrado", 404)
  const filas = await prisma.evtPastoreo.findMany({
    where: { sectorId: id },
    include: { lote: { select: { id: true, nombre: true, especie: { select: { nombre: true } } } } },
    orderBy: { ingreso: "desc" },
    take: limit,
  })
  const ahora = Date.now()
  const data = filas.map((p, i) => {
    const fin = p.egreso ?? null
    // Descanso previo a este pastoreo: desde el egreso del pastoreo anterior (cronológico)
    const anterior = filas[i + 1]
    return {
      id: p.id,
      lote: p.lote,
      ingreso: p.ingreso,
      egreso: fin,
      animales: p.animalesPromedio,
      dias: Math.max(0, Math.round(((fin ? fin.getTime() : ahora) - p.ingreso.getTime()) / DIA)),
      descansoPrevio: anterior?.egreso ? Math.max(0, Math.round((p.ingreso.getTime() - anterior.egreso.getTime()) / DIA)) : null,
      abierto: !fin,
    }
  })
  return NextResponse.json({ success: true, data })
}))
