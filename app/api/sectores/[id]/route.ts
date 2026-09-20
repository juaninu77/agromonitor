import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { mapBody, mapField, MapError, mapResult } from "@/lib/mapa/api"
import { sectorPatchSchema } from "@/lib/mapa/geometry"

export const PATCH = withAuth(async (request, ctx) => mapResult(async () => {
  const id = z.string().uuid().parse(ctx.params.id)
  const { version, geometria, ...data } = sectorPatchSchema.parse(await mapBody(request))
  const current = await prisma.sector.findFirst({ where: { id, establecimientoId: { in: ctx.establecimientoIds }, activo: true } })
  if (!current) throw new MapError("Sector no encontrado", 404)
  mapField(ctx, current.establecimientoId, true)
  const result = await prisma.$transaction(async tx => {
    const row = await tx.sector.update({ where: { id, version }, data: {
      ...data, ...(geometria !== undefined ? { geometria: geometria === null ? Prisma.DbNull : geometria } : {}), version: { increment: 1 },
    } })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[current.establecimientoId], tabla: "sectores", rowPk: id, accion: "UPDATE", detalle: { versionAnterior: current.version, versionNueva: row.version, geometriaAnterior: current.geometria, geometriaNueva: row.geometria } } })
    return row
  })
  return NextResponse.json({ success: true, data: result })
}))
