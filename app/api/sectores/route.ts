import { fieldSectors } from "@/lib/mapa/sector-data"
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { mapBody, mapField, mapResult } from "@/lib/mapa/api"
import { sectorSchema } from "@/lib/mapa/geometry"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import {
  scopeEstablecimiento,
} from "@/lib/api/tenant"

export const GET = withAuth(async (request, ctx) => mapResult(async () => {
  const id = request.nextUrl.searchParams.get("establecimientoId")
  if (id) mapField(ctx, z.string().uuid().parse(id))
  const rows = await fieldSectors(id ? [id] : ctx.establecimientoIds)
  return NextResponse.json({ success: true, data: rows.map(s => ({ ...s, pastoreoActivo: s.pastoreosIngreso[0] ?? null })) })
}))

export const POST = withAuth(async (request, ctx) => mapResult(async () => {
  const raw = await mapBody(request)
  const establecimientoId = mapField(ctx, z.string().uuid().parse(raw.establecimientoId), true)
  const { geometria, ...data } = sectorSchema.parse(raw)
  const sector = await prisma.$transaction(async tx => {
    const row = await tx.sector.create({ data: { ...data, establecimientoId,
      ...(geometria !== undefined ? { geometria: geometria === null ? Prisma.DbNull : geometria } : {}),
    } })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[establecimientoId], tabla: "sectores", rowPk: row.id, accion: "INSERT" } })
    return row
  })
  return NextResponse.json({ success: true, data: sector }, { status: 201 })
}))
