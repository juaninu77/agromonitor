import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api/with-auth"
import { prisma } from "@/lib/prisma"
import { mapBody, mapField, mapResult, MapError } from "@/lib/mapa/api"
import { totalesPorUnidad } from "@/lib/campo/forrajes"
const input = z.object({ clave: z.string().uuid(), tipo: z.enum(["nota", "tarea", "revision_agua", "descanso", "labor"]), detalle: z.string().trim().min(1).max(3000), estado: z.string() }).superRefine((v, ctx) => {
  const allowed: Record<string, string[]> = { nota: ["registrado"], tarea: ["pendiente"], revision_agua: ["disponible", "sin_agua", "requiere_revision"], descanso: ["inicio", "fin"], labor: ["registrado"] }
  if (!allowed[v.tipo].includes(v.estado)) ctx.addIssue({ code: "custom", message: "Estado incompatible con el registro" })
})
async function sector(id: string, ids: string[]) {
  const s = await prisma.sector.findFirst({ where: { id: z.string().uuid().parse(id), establecimientoId: { in: ids }, activo: true } })
  if (!s) throw new MapError("Lugar no encontrado", 404)
  return s
}
export const GET = withAuth(async (request, ctx) => mapResult(async () => {
  const s = await sector(ctx.params.id, ctx.establecimientoIds)
  const page = z.coerce.number().int().min(1).max(100000).parse(request.nextUrl.searchParams.get("page") ?? 1)
  const [registros, totalRegistros, animales, cultivos, documentos, grupos, movimientos, reservas, productos, stock] = await Promise.all([
    prisma.sectorRegistro.findMany({ where: { sectorId: s.id }, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], take: 20, skip: (page - 1) * 20 }),
    prisma.sectorRegistro.count({ where: { sectorId: s.id } }),
    prisma.animal.findMany({ where: { establecimientoId: s.establecimientoId, estadoVital: "activo", ubicacionHist: { some: { sectorId: s.id, hasta: null, desde: { lte: new Date() } } } }, select: { id: true, caravanaVisual: true, otroId: true, especie: { select: { nombre: true } }, categoria: { select: { nombre: true } } }, orderBy: { caravanaVisual: "asc" } }),
    prisma.sectorForraje.findMany({ where: { sectorId: s.id }, include: { forraje: { select: { nombre: true } } }, orderBy: { desde: "desc" } }),
    ctx.establecimientoIdsConRol(["admin", "encargado"]).includes(s.establecimientoId) ? prisma.documentoArchivo.findMany({ where: { sectorId: s.id, establecimientoId: s.establecimientoId, estado: "activo" }, select: { id: true, titulo: true, mime: true, nombreArchivo: true }, take: 50, orderBy: { createdAt: "desc" } }) : [],
    prisma.lote.findMany({ where: { establecimientoId: s.establecimientoId, activo: true }, select: { id: true, nombre: true, especie: { select: { nombre: true } } }, orderBy: { nombre: "asc" } }),
    prisma.evtMovimiento.findMany({ where: { OR: [{ origenSectorId: s.id }, { destinoSectorId: s.id }], animal: { establecimientoId: s.establecimientoId } }, include: { animal: { select: { caravanaVisual: true } }, origenSector: { select: { nombre: true } }, destinoSector: { select: { nombre: true } } }, take: 15, orderBy: { createdAt: "desc" } }),
    prisma.reservaForraje.findMany({ where: { depositoId: s.id, establecimientoId: s.establecimientoId }, include: { forraje: { select: { nombre: true } } }, orderBy: { nombre: "asc" } }),
    s.tipo === "galpon" ? prisma.producto.findMany({ where: { organizacionId: ctx.organizacionDeEstablecimiento[s.establecimientoId] }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }) : [],
    s.tipo === "galpon" ? prisma.movimientoStock.findMany({ where: { sectorId: s.id }, include: { producto: { select: { nombre: true } } }, orderBy: { fecha: "desc" } }) : [],
  ])
  // Forraje trazable: lo producido por las campañas de la parcela, lo consumido en ella y el movimiento del galpón
  const unidad = { reserva: { select: { unidad: true, nombre: true } } }
  const [cosechas, consumos, movsGalpon] = await Promise.all([
    cultivos.length ? prisma.movimientoForraje.findMany({ where: { concepto: "cosecha", cultivoId: { in: cultivos.map((c) => c.id) } }, include: unidad, orderBy: { fecha: "desc" } }) : [],
    prisma.movimientoForraje.findMany({ where: { sectorId: s.id, tipo: "salida" }, include: { ...unidad, lote: { select: { nombre: true } } }, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], take: 200 }),
    s.tipo === "galpon" ? prisma.movimientoForraje.findMany({ where: { reserva: { depositoId: s.id } }, include: unidad, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], take: 10 }) : [],
  ])
  const linea = (m: (typeof consumos)[number] | (typeof cosechas)[number]) => ({ id: m.id, fecha: m.fecha, tipo: m.tipo, concepto: m.concepto, cantidad: m.cantidad.toString(), unidad: m.reserva.unidad, reserva: m.reserva.nombre, motivo: m.motivo, lote: "lote" in m ? m.lote?.nombre ?? null : null })
  const forraje = {
    producido: totalesPorUnidad(cosechas.map((c) => ({ cantidad: c.cantidad, unidad: c.reserva.unidad }))),
    cosechasPorCultivo: Object.fromEntries(cultivos.map((c) => [c.id, totalesPorUnidad(cosechas.filter((m) => m.cultivoId === c.id).map((m) => ({ cantidad: m.cantidad, unidad: m.reserva.unidad })))])),
    consumido: totalesPorUnidad(consumos.map((c) => ({ cantidad: c.cantidad, unidad: c.reserva.unidad }))),
    consumos: consumos.slice(0, 10).map(linea),
    movimientosGalpon: movsGalpon.map(linea),
  }
  const existencias = new Map<string, { id: string; nombre: string; cantidad: number }>()
  for (const m of stock) { const item = existencias.get(m.productoId) ?? { id: m.productoId, nombre: m.producto.nombre, cantidad: 0 }; item.cantidad = Math.round((item.cantidad + (m.tipo === "salida" ? -1 : 1) * Number(m.cantidad)) * 1000) / 1000; existencias.set(m.productoId, item) }
  return NextResponse.json({ registros, totalRegistros, page, animales, cultivos, documentos, grupos, movimientos, reservas, productos, existencias: [...existencias.values()], forraje, puedeEditar: ctx.establecimientoIdsConRol(["admin", "encargado"]).includes(s.establecimientoId) }, { headers: { "Cache-Control": "private, no-store" } })
}))
export const POST = withAuth(async (request, ctx) => mapResult(async () => {
  const s = await sector(ctx.params.id, ctx.establecimientoIds); mapField(ctx, s.establecimientoId, true)
  const v = input.parse(await mapBody(request))
  if (["descanso", "labor"].includes(v.tipo) && !["potrero", "cultivo"].includes(s.tipo)) throw new MapError("Este registro corresponde a una parcela")
  const prior = await prisma.sectorRegistro.findUnique({ where: { clave: v.clave } })
  if (prior) { if (prior.sectorId !== s.id || prior.tipo !== v.tipo || prior.detalle !== v.detalle || prior.estado !== v.estado) throw new MapError("La operación ya existe con otros datos", 409); return NextResponse.json({ data: prior }) }
  const row = await prisma.$transaction(async tx => {
    const r = await tx.sectorRegistro.create({ data: { ...v, sectorId: s.id } })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[s.establecimientoId], tabla: "sector_registros", rowPk: r.id, accion: "INSERT" } }); return r
  })
  return NextResponse.json({ data: row }, { status: 201 })
}))
export const PATCH = withAuth(async (request, ctx) => mapResult(async () => {
  const s = await sector(ctx.params.id, ctx.establecimientoIds); mapField(ctx, s.establecimientoId, true)
  const v = z.object({ id: z.string().uuid(), version: z.number().int().positive() }).parse(await mapBody(request))
  const row = await prisma.$transaction(async tx => {
    const r = await tx.sectorRegistro.update({ where: { id: v.id, sectorId: s.id, tipo: "tarea", estado: "pendiente", version: v.version }, data: { estado: "completada", resueltoAt: new Date(), version: { increment: 1 } } })
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[s.establecimientoId], tabla: "sector_registros", rowPk: r.id, accion: "UPDATE" } }); return r
  })
  return NextResponse.json({ data: row })
}))
