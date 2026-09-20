import { z } from "zod"
import { mapBody, mapField, mapResult, MapError } from "@/lib/mapa/api"
import { isParcel } from "@/lib/mapa/sector-state"
import { fechaSchema } from "@/lib/administracion/validation"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/api/with-auth"
import { sectorDelTenant } from "@/lib/api/tenant"

export const GET = withAuth(async (request, ctx) => {
  try {
    const sectorId = ctx.params.id

    const sector = await sectorDelTenant(sectorId, ctx.establecimientoIds)
    if (!sector) {
      return NextResponse.json(
        { error: "Sector no encontrado" },
        { status: 404 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const [mediciones, total] = await Promise.all([
      prisma.medicionPotrero.findMany({
        where: { sectorId },
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      prisma.medicionPotrero.count({ where: { sectorId } }),
    ])

    return NextResponse.json({
      success: true,
      data: mediciones,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error al obtener mediciones:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
})

const number = (max: number) => z.preprocess(v => v === "" || v === null || v === undefined ? null : v, z.coerce.number().finite().min(0).max(max).nullable())
export const POST = withAuth(async (request, ctx) => mapResult(async () => {
  const id = z.string().uuid().parse(ctx.params.id)
  const sector = await sectorDelTenant(id, ctx.establecimientoIds)
  if (!sector) throw new MapError("Sector no encontrado",404)
  mapField(ctx, sector.establecimientoId, true)
  if (!isParcel(sector.tipo)) throw new MapError("Las mediciones de pasto se registran en parcelas")
  const v = z.object({ fecha: fechaSchema, alturaPastoCm: number(1000), msKgHa: number(100000), coberturaPct: number(100), observ: z.string().trim().max(3000).optional() }).refine(v => v.alturaPastoCm !== null || v.msKgHa !== null || v.coberturaPct !== null, "Ingresá al menos una medición").parse(await mapBody(request))
  const row = await prisma.$transaction(async tx => {
    const r = await tx.medicionPotrero.create({ data: { ...v, fecha: new Date(v.fecha + "T00:00:00Z"), sectorId: id } })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[sector.establecimientoId], tabla: "mediciones_potrero", rowPk: r.id, accion: "INSERT" } }); return r
  })
  return NextResponse.json({ success: true, data: row }, { status: 201 })
}))
