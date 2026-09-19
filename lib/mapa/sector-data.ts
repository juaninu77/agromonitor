import { prisma } from "@/lib/prisma"
import { areaHa, geometrySchema } from "./geometry"
export async function fieldSectors(fieldIds: string[]) {
  const now = new Date()
  const sectors = await prisma.sector.findMany({ where: { establecimientoId: { in: fieldIds }, activo: true }, orderBy: { nombre: "asc" }, include: {
    forrajes: { where: { desde: { lte: now }, OR: [{ hasta: null }, { hasta: { gt: now } }] }, include: { forraje: { select: { nombre: true } } } },
    pastoreosIngreso: { where: { ingreso: { lte: now }, egreso: null, lote: { activo: true } }, include: { lote: { select: { id: true, nombre: true, establecimientoId: true, especie: { select: { nombre: true } } } } } },
    mediciones: { orderBy: { fecha: "desc" }, take: 1 },
    registros: { where: { tipo: { in: ["revision_agua", "descanso"] } }, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], distinct: ["tipo"] },
    _count: { select: { registros: { where: { tipo: "tarea", estado: "pendiente" } }, movimientosOrigen: true, movimientosDestino: true } },
  } })
  const locations = await prisma.ubicacionHist.findMany({ where: { hasta: null, desde: { lte: now }, sector: { establecimientoId: { in: fieldIds } }, animal: { estadoVital: "activo", establecimientoId: { in: fieldIds } } }, select: { sectorId: true, animal: { select: { establecimientoId: true, especie: { select: { nombre: true } } } } } })
  return sectors.map(s => {
    const located = locations.filter(l => l.sectorId === s.id && l.animal.establecimientoId === s.establecimientoId)
    const parsed = geometrySchema.safeParse(s.geometria), geometria = parsed.success ? parsed.data : null
    return { ...s, registros: undefined, geometria, areaMapaHa: areaHa(geometria),
      bovinos: located.filter(l => l.animal.especie.nombre.toLowerCase() === "bovino").length,
      ovinos: located.filter(l => l.animal.especie.nombre.toLowerCase() === "ovino").length,
      pastoreosIngreso: s.pastoreosIngreso.filter(p => p.lote.establecimientoId === s.establecimientoId),
      ultimaMedicion: s.mediciones[0] ?? null,
      agua: s.registros.find(r => r.tipo === "revision_agua") ?? null,
      descanso: s.registros.find(r => r.tipo === "descanso") ?? null,
      pendientes: s._count.registros,
      movimientosRecientes: s._count.movimientosOrigen + s._count.movimientosDestino,
    }
  })
}
