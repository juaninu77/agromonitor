import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/lib/api/with-auth"
import { mapField, MapError } from "./api"
import { livestockTypes, isParcel } from "./sector-state"
import { conClave } from "./idempotencia"
const schema = z.object({
  destinoSectorId: z.string().uuid(), origenSectorId: z.string().uuid().optional(),
  animalIds: z.array(z.string().uuid()).min(1).max(500).optional(), loteId: z.string().uuid().optional(),
  motivo: z.string().trim().max(1000).default("Movimiento registrado desde Potreros"),
  // Generada en el dispositivo: un reenvío desde la cola sin conexión no mueve dos veces
  clave: z.string().uuid().optional(),
}).refine(v => Boolean(v.animalIds) !== Boolean(v.loteId), "Elegí animales o un grupo completo")
export async function moveAnimals(raw: unknown, ctx: AuthContext) {
  const v = schema.parse(raw)
  return prisma.$transaction(async tx => conClave(tx, { clave: v.clave, usuarioId: ctx.userId, ruta: "mapa/movimientos" }, async () => {
    const destination = await tx.sector.findFirst({ where: { id: v.destinoSectorId, establecimientoId: { in: ctx.establecimientoIds }, activo: true } })
    if (!destination) throw new MapError("Destino no encontrado", 404)
    mapField(ctx, destination.establecimientoId, true)
    if (!livestockTypes.has(destination.tipo)) throw new MapError("Este lugar no admite hacienda")
    const group = v.loteId ? await tx.lote.findFirst({ where: { id: v.loteId, establecimientoId: destination.establecimientoId, activo: true } }) : null
    if (v.loteId && !group) throw new MapError("Grupo no encontrado en este campo", 404)
    const ids = v.animalIds ? [...new Set(v.animalIds)] : (await tx.animalLoteHist.findMany({ where: { loteId: v.loteId!, hasta: null, animal: { estadoVital: "activo", establecimientoId: destination.establecimientoId } }, select: { animalId: true } })).map(a => a.animalId)
    if (!ids.length || ids.length > 500) throw new MapError("El grupo debe tener entre 1 y 500 animales activos; mové grupos más pequeños")
    const animals = await tx.animal.findMany({ where: { id: { in: ids }, establecimientoId: destination.establecimientoId, estadoVital: "activo" }, include: { ubicacionHist: { where: { hasta: null } } } })
    if (animals.length !== ids.length || (group && animals.some(a => a.especieId !== group.especieId))) throw new MapError("Los animales deben estar activos y pertenecer al campo y especie del grupo")
    if (v.origenSectorId && animals.some(a => a.ubicacionHist[0]?.sectorId !== v.origenSectorId)) throw new MapError("La ubicación cambió. Actualizá la ficha antes de mover", 409)
    const moving = animals.filter(a => a.ubicacionHist[0]?.sectorId !== destination.id)
    if (!moving.length) throw new MapError("Los animales ya están en ese lugar", 409)
    const now = new Date()
    if (animals.some(a => a.ubicacionHist.some(u => u.desde > now))) throw new MapError("Hay ubicaciones futuras. Revisá el historial antes de mover", 409)
    const movingIds = moving.map(a => a.id)
    await tx.ubicacionHist.updateMany({ where: { animalId: { in: movingIds }, hasta: null }, data: { hasta: now } })
    await tx.ubicacionHist.createMany({ data: movingIds.map(animalId => ({ animalId, sectorId: destination.id, desde: now, motivo: v.motivo })) })
    await tx.evtMovimiento.createMany({ data: moving.map(a => ({ animalId: a.id, origenSectorId: a.ubicacionHist[0]?.sectorId ?? null, destinoSectorId: destination.id, fecha: now, motivo: v.motivo, cantidadAnimales: 1 })) })
    const pasture = await actualizarPastoreos(tx, movingIds, destination, group?.id ?? null, now, v.motivo)
    await tx.auditLog.create({ data: { usuarioId: ctx.userId, organizacionId: ctx.organizacionDeEstablecimiento[destination.establecimientoId], tabla: "movimientos_potrero", rowPk: destination.id, accion: "INSERT", detalle: { cantidad: moving.length, animalIds: movingIds, grupoId: group?.id ?? null } } })
    return { id: pasture?.id ?? destination.id, moved: moving.length, destino: destination.nombre }
  }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 })
}

/** Animales activos del lote ubicados ahora en el lugar. */
const enLugar = (tx: Prisma.TransactionClient, loteId: string, sectorId: string) =>
  tx.ubicacionHist.count({ where: { sectorId, hasta: null, animal: { estadoVital: "activo", loteHist: { some: { loteId, hasta: null } } } } })

/**
 * Mantiene la rotación coherente con las ubicaciones:
 * - un pastoreo abierto se cierra solo cuando su lote ya no tiene animales en ese lugar;
 * - se abre uno nuevo cuando todo el lote (elegido como grupo o animal por animal)
 *   queda en la parcela destino y no había uno abierto ahí.
 */
export async function actualizarPastoreos(
  tx: Prisma.TransactionClient,
  movingIds: string[],
  destination: { id: string; tipo: string; establecimientoId: string },
  grupoId: string | null,
  now: Date,
  motivo: string,
) {
  const memberships = await tx.animalLoteHist.findMany({ where: { animalId: { in: movingIds }, hasta: null }, select: { loteId: true } })
  const loteIds = [...new Set([...memberships.map(m => m.loteId), ...(grupoId ? [grupoId] : [])])]
  if (!loteIds.length) return null
  const abiertos = await tx.evtPastoreo.findMany({ where: { loteId: { in: loteIds }, egreso: null }, select: { id: true, loteId: true, sectorId: true } })
  const cerrar: string[] = []
  for (const p of abiertos) if (p.sectorId !== destination.id && await enLugar(tx, p.loteId, p.sectorId) === 0) cerrar.push(p.id)
  if (cerrar.length) await tx.evtPastoreo.updateMany({ where: { id: { in: cerrar } }, data: { egreso: now } })
  if (!isParcel(destination.tipo)) return null
  let creado: { id: string } | null = null
  for (const loteId of loteIds) {
    if (abiertos.some(p => p.loteId === loteId && p.sectorId === destination.id)) continue
    const miembros = await tx.animalLoteHist.count({ where: { loteId, hasta: null, animal: { estadoVital: "activo", establecimientoId: destination.establecimientoId } } })
    const presentes = await enLugar(tx, loteId, destination.id)
    if (miembros > 0 && presentes === miembros) {
      creado = await tx.evtPastoreo.create({ data: { sectorId: destination.id, loteId, ingreso: now, animalesPromedio: presentes, observ: motivo } })
    }
  }
  return creado
}
