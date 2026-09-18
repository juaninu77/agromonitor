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

export const GET = withAuth(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const establecimientoId = searchParams.get("establecimientoId")

    if (establecimientoId && !ctx.establecimientoIds.includes(establecimientoId)) {
      return NextResponse.json(
        { error: "No tienes acceso a ese establecimiento" },
        { status: 403 }
      )
    }

    const sectores = await prisma.sector.findMany({
      where: {
        ...(establecimientoId
          ? { establecimientoId }
          : scopeEstablecimiento(ctx.establecimientoIds)),
        activo: true,
      },
      include: {
        _count: {
          select: {
            movimientosOrigen: true,
            movimientosDestino: true,
          },
        },
        pastoreosIngreso: {
          where: { egreso: null },
          include: { lote: true },
          take: 1,
        },
        mediciones: {
          orderBy: { fecha: "desc" },
          take: 1,
        },
      },
      orderBy: { nombre: "asc" },
    })

    const data = sectores.map((s) => ({
      id: s.id,
      version: s.version,
      nombre: s.nombre,
      tipo: s.tipo,
      superficieHa: s.superficieHa,
      uso: s.uso,
      capacidad: s.capacidad,
      tieneAgua: s.tieneAgua,
      tieneSombra: s.tieneSombra,
      tieneBalanza: s.tieneBalanza,
      descripcion: s.descripcion,
      activo: s.activo,
      movimientosRecientes:
        s._count.movimientosOrigen + s._count.movimientosDestino,
      pastoreoActivo: s.pastoreosIngreso[0] ?? null,
      ultimaMedicion: s.mediciones[0] ?? null,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error al obtener sectores:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

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
