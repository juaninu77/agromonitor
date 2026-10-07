import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { mapBody, mapField, MapError, mapResult } from "@/lib/mapa/api"

const bodySchema = z.object({
  egreso: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
}).strict()

// PATCH /api/pastoreo/[id] — registrar la salida de un grupo (cierre de un pastoreo declarado).
// Si el grupo todavía tiene animales en el lugar, hay que moverlos: el cierre se registra solo.
export const PATCH = withAuth(async (request, ctx) => mapResult(async () => {
  const id = z.string().uuid().parse(ctx.params.id)
  const { egreso } = bodySchema.parse(await mapBody(request))
  const fecha = new Date(egreso.length === 10 ? `${egreso}T12:00:00Z` : egreso)
  const pastoreo = await prisma.evtPastoreo.findFirst({ where: { id, sector: { establecimientoId: { in: ctx.establecimientoIds } } }, include: { sector: { select: { establecimientoId: true, nombre: true } } } })
  if (!pastoreo) throw new MapError("Pastoreo no encontrado", 404)
  mapField(ctx, pastoreo.sector.establecimientoId, true)
  if (pastoreo.egreso) throw new MapError("Ese pastoreo ya tiene salida registrada", 409)
  if (fecha.getTime() > Date.now() + 5 * 60_000) throw new MapError("La salida no puede ser futura")
  if (fecha < pastoreo.ingreso) throw new MapError("La salida no puede ser anterior al ingreso")
  const quedan = await prisma.ubicacionHist.count({ where: { sectorId: pastoreo.sectorId, hasta: null, animal: { estadoVital: "activo", loteHist: { some: { loteId: pastoreo.loteId, hasta: null } } } } })
  if (quedan > 0) throw new MapError(`El grupo todavía tiene ${quedan} ${quedan === 1 ? "animal" : "animales"} en ${pastoreo.sector.nombre}. Usá «Mover animales»: la salida se registra sola.`, 409)
  const row = await prisma.$transaction(async (tx) => {
    const r = await tx.evtPastoreo.update({ where: { id }, data: { egreso: fecha } })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[pastoreo.sector.establecimientoId], tabla: "evt_pastoreo", rowPk: id, accion: "UPDATE", detalle: { egreso: fecha.toISOString() } } })
    return r
  })
  return NextResponse.json({ success: true, data: row })
}))
