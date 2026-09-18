import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { mapField, mapResult } from "@/lib/mapa/api"
import { geometrySchema, areaHa } from "@/lib/mapa/geometry"

export const GET = withAuth(async (request, ctx) => mapResult(async () => {
  const id = mapField(ctx, z.string().uuid().parse(request.nextUrl.searchParams.get("establecimientoId")))
  const sectors = await prisma.sector.findMany({ where: { establecimientoId: id, activo: true }, orderBy: { nombre: "asc" }, include: {
    forrajes: { where: { hasta: null }, include: { forraje: { select: { nombre: true } } } },
    pastoreosIngreso: { where: { egreso: null, lote: { establecimientoId: id, activo: true } }, include: { lote: { select: { id: true, nombre: true, especie: { select: { nombre: true } } } } } },
  } })
  const counts = await Promise.all(["bovino", "ovino"].map(especie => prisma.ubicacionHist.groupBy({
    by: ["sectorId"], where: { hasta: null, sector: { establecimientoId: id }, animal: { establecimientoId: id, estadoVital: "activo", especie: { nombre: { equals: especie, mode: "insensitive" } } } }, _count: { _all: true },
  })))
  const countMap = counts.map(rows => new Map(rows.map(row => [row.sectorId, row._count._all])))
  return NextResponse.json({ data: sectors.map(s => {
    const parsed = geometrySchema.safeParse(s.geometria)
    const geometria = parsed.success ? parsed.data : null
    return { ...s, geometria, areaMapaHa: areaHa(geometria), bovinos: countMap[0].get(s.id) ?? 0, ovinos: countMap[1].get(s.id) ?? 0 }
  }), puedeEditar: ctx.establecimientoIdsConRol(["admin", "encargado"]).includes(id) }, { headers: { "Cache-Control": "private, no-store" } })
}))
