import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { mapBody, mapField, mapResult, MapError } from "@/lib/mapa/api"
const schema = z.object({ clave: z.string().uuid(), productoId: z.string().uuid(), tipo: z.enum(["entrada", "salida"]), cantidad: z.number().finite().positive().max(10000000), motivo: z.string().trim().min(1).max(1000) })
export const POST = withAuth(async (request, ctx) => mapResult(async () => {
  const id = z.string().uuid().parse(ctx.params.id), v = schema.parse(await mapBody(request))
  const result = await prisma.$transaction(async tx => {
    const sector = await tx.sector.findFirst({ where: { id, tipo: "galpon", activo: true, establecimientoId: { in: ctx.establecimientoIds } } })
    if (!sector) throw new MapError("Depósito no encontrado", 404)
    mapField(ctx, sector.establecimientoId, true)
    const org = ctx.organizacionDeEstablecimiento[sector.establecimientoId]
    const product = await tx.producto.findFirst({ where: { id: v.productoId, organizacionId: org } })
    if (!product) throw new MapError("Producto no encontrado", 404)
    const prior = await tx.movimientoStock.findUnique({ where: { clave: v.clave } })
    if (prior) { if (prior.sectorId !== id || prior.productoId !== v.productoId || prior.tipo !== v.tipo || prior.cantidad !== v.cantidad || prior.motivo !== v.motivo) throw new MapError("La clave ya fue utilizada", 409); return prior }
    const grouped = await tx.movimientoStock.groupBy({ by: ["tipo"], where: { sectorId: id, productoId: v.productoId }, _sum: { cantidad: true } })
    const stock = grouped.reduce((n, r) => n + (r.tipo === "salida" ? -1 : 1) * (r._sum.cantidad ?? 0), 0)
    if (v.tipo === "salida" && v.cantidad > stock) throw new MapError("Stock insuficiente en este galpón", 409)
    const row = await tx.movimientoStock.create({ data: { ...v, sectorId: id } })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: org, tabla: "movimientos_stock", rowPk: row.id, accion: "INSERT" } })
    return row
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
  return NextResponse.json({ data: result }, { status: 201 })
}))
