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
    _count: { select: { registros: { where: { tipo: "tarea", estado: "pendiente" } }, tareas: { where: { estado: { in: ["pendiente", "en_progreso"] } } }, movimientosOrigen: true, movimientosDestino: true } },
  } })
  // Ubicaciones actuales agregadas en SQL por lugar, especie y categoría (sin traer el rodeo a memoria)
  const conteos = fieldIds.length ? await prisma.$queryRaw<{ sector_id: string; especie: string; categoria: string | null; cantidad: number; desde: Date }[]>`
    SELECT u.sector_id, e.nombre AS especie, c.nombre AS categoria, count(*)::int AS cantidad, min(u.desde) AS desde
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
  const ocupadoDesde = new Map<string, Date>()
  for (const c of conteos) {
    porSector.set(c.sector_id, [...(porSector.get(c.sector_id) ?? []), { especie: c.especie, categoria: c.categoria, cantidad: Number(c.cantidad) }])
    const previo = ocupadoDesde.get(c.sector_id)
    if (!previo || c.desde < previo) ocupadoDesde.set(c.sector_id, c.desde)
  }
  // Última salida de animales (ubicaciones cerradas o pastoreos con egreso), para los días de descanso
  const salidas = fieldIds.length ? await prisma.$queryRaw<{ sector_id: string; ultima: Date }[]>`
    SELECT sector_id, max(fin) AS ultima FROM (
      SELECT u.sector_id, max(u.hasta) AS fin FROM ubicacion_hist u JOIN sectores s ON s.id = u.sector_id
      WHERE u.hasta IS NOT NULL AND u.hasta <= ${now} AND s.establecimiento_id = ANY(${fieldIds}::uuid[]) GROUP BY 1
      UNION ALL
      SELECT p.sector_id, max(p.egreso) FROM evt_pastoreo p JOIN sectores s ON s.id = p.sector_id
      WHERE p.egreso IS NOT NULL AND p.egreso <= ${now} AND s.establecimiento_id = ANY(${fieldIds}::uuid[]) GROUP BY 1
    ) t GROUP BY 1` : []
  const ultimaSalida = new Map(salidas.map(r => [r.sector_id, r.ultima]))
  // Inicio de la ocupación continua actual: la última vez que el lugar pasó de vacío
  // a ocupado (barrido de intervalos ordenados; un hueco entre intervalos corta la racha).
  const rachas = fieldIds.length ? await prisma.$queryRaw<{ sector_id: string; inicio: Date }[]>`
    WITH iv AS (
      SELECT u.sector_id, u.desde, coalesce(u.hasta, 'infinity'::timestamp) AS hasta
      FROM ubicacion_hist u JOIN sectores s ON s.id = u.sector_id
      WHERE s.establecimiento_id = ANY(${fieldIds}::uuid[]) AND u.desde <= ${now}
    ), o AS (
      SELECT sector_id, desde, max(hasta) OVER (PARTITION BY sector_id ORDER BY desde ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS previo
      FROM iv
    )
    SELECT sector_id, max(desde) AS inicio FROM o WHERE previo IS NULL OR desde > previo GROUP BY 1` : []
  const inicioRacha = new Map(rachas.map(r => [r.sector_id, r.inicio]))
  const dias = (d: Date) => Math.max(0, Math.floor((now.getTime() - new Date(d).getTime()) / 86_400_000))
  return sectors.map(s => {
    const parsed = geometrySchema.safeParse(s.geometria), geometria = parsed.success ? parsed.data : null
    const areaMapaHa = areaHa(geometria)
    const carga = cargaDeLugar(porSector.get(s.id) ?? [], s.superficieHa ?? areaMapaHa, s.capacidad)
    const entrada = carga.animales > 0 ? (inicioRacha.get(s.id) ?? s.pastoreosIngreso[0]?.ingreso ?? ocupadoDesde.get(s.id)) : undefined
    const salida = ultimaSalida.get(s.id)
    return { ...s, registros: undefined, geometria, areaMapaHa, ...carga,
      diasOcupacion: entrada ? dias(entrada) : null,
      ocupadoDesde: entrada ?? null,
      diasDescanso: carga.animales === 0 && salida ? dias(salida) : null,
      ultimaSalida: salida ?? null,
      bovinos: carga.porEspecie.bovino ?? 0,
      ovinos: carga.porEspecie.ovino ?? 0,
      pastoreosIngreso: s.pastoreosIngreso.filter(p => p.lote.establecimientoId === s.establecimientoId),
      ultimaMedicion: s.mediciones[0] ?? null,
      agua: s.registros.find(r => r.tipo === "revision_agua") ?? null,
      descanso: s.registros.find(r => r.tipo === "descanso") ?? null,
      // Tareas del lugar: las de la ficha y las del módulo Tareas vinculadas al lugar
      pendientes: s._count.registros + s._count.tareas,
      movimientosRecientes: s._count.movimientosOrigen + s._count.movimientosDestino,
    }
  })
}
