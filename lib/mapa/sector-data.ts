import { prisma } from "@/lib/prisma"
import { areaHa, geometrySchema } from "./geometry"
import { cargaDeLugar, type ConteoUbicacion } from "./carga"
export async function fieldSectors(fieldIds: string[]) {
  const now = new Date()
  const sectors = await prisma.sector.findMany({ where: { establecimientoId: { in: fieldIds }, activo: true }, orderBy: { nombre: "asc" }, include: {
    forrajes: { where: { desde: { lte: now }, OR: [{ hasta: null }, { hasta: { gt: now } }] }, include: { forraje: { select: { nombre: true } } } },
    pastoreosIngreso: { where: { ingreso: { lte: now }, egreso: null, lote: { activo: true } }, include: { lote: { select: { id: true, nombre: true, establecimientoId: true, especie: { select: { nombre: true } } } } } },
    mediciones: { orderBy: { fecha: "desc" }, take: 1 },
    registros: { where: { tipo: { in: ["revision_agua", "descanso"] } }, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], distinct: ["tipo"] },
    _count: { select: { registros: { where: { tipo: "tarea", estado: "pendiente" } }, movimientosOrigen: true, movimientosDestino: true } },
  } })
  // Ubicaciones actuales agregadas en SQL por lugar, especie y categoría (sin traer el rodeo a memoria)
  const conteos = fieldIds.length ? await prisma.$queryRaw<{ sector_id: string; especie: string; categoria: string | null; cantidad: number }[]>`
    SELECT u.sector_id, e.nombre AS especie, c.nombre AS categoria, count(*)::int AS cantidad
    FROM ubicacion_hist u
    JOIN sectores s ON s.id = u.sector_id
    JOIN animales a ON a.id = u.animal_id
    JOIN especies e ON e.id = a.especie_id
    LEFT JOIN categorias c ON c.id = a.categoria_id
    WHERE u.hasta IS NULL AND u.desde <= ${now}
      AND s.establecimiento_id = ANY(${fieldIds}::uuid[])
      AND a.estado_vital = 'activo' AND a.establecimiento_id = s.establecimiento_id
    GROUP BY 1, 2, 3` : []
  const porSector = new Map<string, ConteoUbicacion[]>()
  for (const c of conteos) porSector.set(c.sector_id, [...(porSector.get(c.sector_id) ?? []), { especie: c.especie, categoria: c.categoria, cantidad: Number(c.cantidad) }])
  return sectors.map(s => {
    const parsed = geometrySchema.safeParse(s.geometria), geometria = parsed.success ? parsed.data : null
    const areaMapaHa = areaHa(geometria)
    const carga = cargaDeLugar(porSector.get(s.id) ?? [], s.superficieHa ?? areaMapaHa, s.capacidad)
    return { ...s, registros: undefined, geometria, areaMapaHa, ...carga,
      bovinos: carga.porEspecie.bovino ?? 0,
      ovinos: carga.porEspecie.ovino ?? 0,
      pastoreosIngreso: s.pastoreosIngreso.filter(p => p.lote.establecimientoId === s.establecimientoId),
      ultimaMedicion: s.mediciones[0] ?? null,
      agua: s.registros.find(r => r.tipo === "revision_agua") ?? null,
      descanso: s.registros.find(r => r.tipo === "descanso") ?? null,
      pendientes: s._count.registros,
      movimientosRecientes: s._count.movimientosOrigen + s._count.movimientosDestino,
    }
  })
}
